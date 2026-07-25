'use server';

import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import type { CartLine } from '@/lib/cart/types';

export type RevalidatedCartLine = CartLine & {
  available: boolean;
  issues: string[];
  unitPriceGrosz: number;
  lineTotalGrosz: number;
  remainingCapacity?: number;
};

export type RevalidatedCart = {
  lines: RevalidatedCartLine[];
  subtotalGrosz: number;
  shippingQuoteRequired: boolean;
  canCheckout: boolean;
};

export async function revalidateCartLines(
  lines: CartLine[]
): Promise<RevalidatedCart> {
  if (!lines.length) {
    return {
      lines: [],
      subtotalGrosz: 0,
      shippingQuoteRequired: false,
      canCheckout: false,
    };
  }

  const supabase = createCartAdminClient();
  const now = new Date().toISOString();
  const result: RevalidatedCartLine[] = [];
  let shippingQuoteRequired = false;

  for (const line of lines) {
    if (line.type === 'workshop_session') {
      const { data: session } = await supabase
        .from('workshop_sessions')
        .select(
          'id, starts_at, timezone, capacity, reserved_count, price_gross_grosz, status, location_name, location_address, venue_key, booking_opens_at, booking_closes_at, workshops!inner(id, title, slug, status, archived_at, booking_mode, default_price_gross_grosz)'
        )
        .eq('id', line.sessionId)
        .maybeSingle();

      const workshop = session?.workshops as unknown as {
        id: string;
        title: string;
        slug: string;
        status: string;
        archived_at: string | null;
        booking_mode: string;
        default_price_gross_grosz: number;
      } | null;

      const issues: string[] = [];
      if (!session || !workshop) {
        issues.push('Termin nie istnieje lub został usunięty.');
      } else {
        if (workshop.status !== 'published' || workshop.archived_at) {
          issues.push('Warsztat nie jest już dostępny.');
        }
        if (workshop.booking_mode !== 'scheduled') {
          issues.push('Ten warsztat nie jest rezerwowany przez koszyk.');
        }
        if (!['scheduled', 'sold_out'].includes(session.status)) {
          issues.push('Termin został odwołany lub zakończony.');
        }
        if (session.starts_at <= now) {
          issues.push('Termin już minął.');
        }
        if (session.booking_opens_at && session.booking_opens_at > now) {
          issues.push('Rezerwacje na ten termin nie są jeszcze otwarte.');
        }
        if (session.booking_closes_at && session.booking_closes_at < now) {
          issues.push('Rezerwacje na ten termin zostały zamknięte.');
        }
        const remaining = session.capacity - session.reserved_count;
        if (remaining < line.quantity) {
          issues.push(
            remaining <= 0
              ? 'Brak wolnych miejsc.'
              : `Pozostało tylko ${remaining} miejsc.`
          );
        }
      }

      const unitPriceGrosz =
        session?.price_gross_grosz ??
        workshop?.default_price_gross_grosz ??
        line.unitPriceHintGrosz;
      if (
        session &&
        line.unitPriceHintGrosz > 0 &&
        unitPriceGrosz !== line.unitPriceHintGrosz
      ) {
        issues.push('Cena uległa zmianie — pokazujemy aktualną cenę.');
      }

      const available = issues.every(
        (i) => i === 'Cena uległa zmianie — pokazujemy aktualną cenę.'
      );

      result.push({
        ...line,
        workshopId: workshop?.id ?? line.workshopId,
        workshopSlug: workshop?.slug ?? line.workshopSlug,
        workshopTitle: workshop?.title ?? line.workshopTitle,
        startsAt: session?.starts_at ?? line.startsAt,
        timezone: session?.timezone ?? line.timezone,
        venueKey: session?.venue_key ?? line.venueKey,
        locationName: session?.location_name ?? line.locationName,
        locationAddress: session?.location_address ?? line.locationAddress,
        unitPriceHintGrosz: unitPriceGrosz,
        available,
        issues,
        unitPriceGrosz,
        lineTotalGrosz: unitPriceGrosz * line.quantity,
        remainingCapacity: session
          ? session.capacity - session.reserved_count
          : 0,
      });
      continue;
    }

    const { data: product } = await supabase
      .from('products')
      .select(
        'id, sku, slug, title, status, archived_at, price_gross_grosz, product_type, requires_shipping, allows_pickup, track_inventory, inventory_quantity, shipping_fee_mode'
      )
      .eq('id', line.productId)
      .maybeSingle();

    const issues: string[] = [];
    if (!product) {
      issues.push('Produkt nie istnieje.');
    } else {
      if (product.status !== 'published' || product.archived_at) {
        issues.push('Produkt nie jest już dostępny.');
      }
      if (line.fulfillment === 'shipping' && !product.requires_shipping) {
        issues.push('Ten produkt nie obsługuje wysyłki.');
      }
      if (line.fulfillment === 'pickup' && !product.allows_pickup) {
        issues.push('Ten produkt nie obsługuje odbioru w pracowni.');
      }
      if (
        product.track_inventory &&
        product.inventory_quantity < line.quantity
      ) {
        issues.push('Niewystarczający stan magazynowy.');
      }
      if (
        line.fulfillment === 'shipping' &&
        product.shipping_fee_mode === 'quote_required'
      ) {
        shippingQuoteRequired = true;
      }
    }

    const unitPriceGrosz =
      product?.price_gross_grosz ?? line.unitPriceHintGrosz;
    if (
      product &&
      line.unitPriceHintGrosz > 0 &&
      unitPriceGrosz !== line.unitPriceHintGrosz
    ) {
      issues.push('Cena uległa zmianie — pokazujemy aktualną cenę.');
    }

    const available = issues.every(
      (i) => i === 'Cena uległa zmianie — pokazujemy aktualną cenę.'
    );

    result.push({
      ...line,
      sku: product?.sku ?? line.sku,
      slug: product?.slug ?? line.slug,
      title: product?.title ?? line.title,
      type:
        product?.product_type === 'studio_service'
          ? 'studio_service'
          : 'physical_product',
      requiresShipping: product?.requires_shipping ?? line.requiresShipping,
      unitPriceHintGrosz: unitPriceGrosz,
      available,
      issues,
      unitPriceGrosz,
      lineTotalGrosz: unitPriceGrosz * line.quantity,
    });
  }

  const blocking = result.some(
    (l) =>
      !l.available ||
      l.issues.some(
        (i) => i !== 'Cena uległa zmianie — pokazujemy aktualną cenę.'
      )
  );
  const subtotalGrosz = result.reduce((s, l) => s + l.lineTotalGrosz, 0);

  return {
    lines: result,
    subtotalGrosz,
    shippingQuoteRequired,
    canCheckout: result.length > 0 && !blocking,
  };
}
