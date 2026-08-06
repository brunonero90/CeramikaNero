'use server';

import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import type { CartLine } from '@/lib/cart/types';

export type FollowupSessionOption = {
  sessionId: string;
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  startsAt: string;
  timezone: string;
  venueKey: string | null;
  locationName: string | null;
  locationAddress: string | null;
  remainingCapacity: number;
  unitPriceGrosz: number;
};

export type RevalidatedCartLine = CartLine & {
  available: boolean;
  issues: string[];
  unitPriceGrosz: number;
  lineTotalGrosz: number;
  remainingCapacity?: number;
  minimumAge?: number | null;
  maximumAge?: number | null;
  /** Backwards-compatible flag for child-only workshops. */
  ageRequired?: boolean;
  participantAudience?: 'adult' | 'child' | 'mixed';
  collectParticipantAge?: boolean;
  offersFollowupSession?: boolean;
  requiresFollowupSession?: boolean;
  followupWorkshopType?: string | null;
  followupMinDays?: number | null;
  followupMaxDays?: number | null;
  followupOptions?: FollowupSessionOption[];
};

export type RevalidatedCart = {
  lines: RevalidatedCartLine[];
  subtotalGrosz: number;
  shippingQuoteRequired: boolean;
  canCheckout: boolean;
};

type WorkshopMeta = {
  id: string;
  title: string;
  slug: string;
  status: string;
  archived_at: string | null;
  booking_mode: string;
  default_price_gross_grosz: number;
  minimum_age: number | null;
  maximum_age: number | null;
  participant_audience?: 'adult' | 'child' | 'mixed' | null;
  collect_participant_age?: boolean | null;
  offers_followup_session?: boolean | null;
  requires_followup_session?: boolean | null;
  followup_workshop_id?: string | null;
  followup_workshop_type?: string | null;
  followup_min_days?: number | null;
  followup_max_days?: number | null;
};

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function findFollowupWorkshopId(
  supabase: ReturnType<typeof createCartAdminClient>,
  workshop: WorkshopMeta
): Promise<string | null> {
  if (workshop.followup_workshop_id) return workshop.followup_workshop_id;
  const type = workshop.followup_workshop_type?.trim();
  if (!type) return null;

  const byType = await supabase
    .from('workshops')
    .select('id')
    .eq('workshop_type' as never, type as never)
    .eq('status', 'published')
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  if ((byType.data as { id?: string } | null)?.id) {
    return (byType.data as { id: string }).id;
  }

  const bySlug = await supabase
    .from('workshops')
    .select('id')
    .eq('slug', type)
    .eq('status', 'published')
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  return (bySlug.data as { id?: string } | null)?.id ?? null;
}

async function loadFollowupOptions(
  supabase: ReturnType<typeof createCartAdminClient>,
  workshop: WorkshopMeta,
  primaryStartsAt: string,
  quantity: number,
  now: string
): Promise<FollowupSessionOption[]> {
  const targetWorkshopId = await findFollowupWorkshopId(supabase, workshop);
  if (!targetWorkshopId) return [];

  const minDays = workshop.followup_min_days ?? 0;
  const maxDays = workshop.followup_max_days ?? 90;
  const start = addDays(primaryStartsAt, minDays);
  const end = addDays(primaryStartsAt, maxDays);

  const { data } = await supabase
    .from('workshop_sessions')
    .select(
      'id, workshop_id, starts_at, timezone, capacity, reserved_count, price_gross_grosz, status, location_name, location_address, venue_key, booking_opens_at, booking_closes_at, workshops!inner(id, title, slug, status, archived_at, default_price_gross_grosz)'
    )
    .eq('workshop_id', targetWorkshopId)
    .in('status', ['scheduled', 'sold_out'])
    .gte('starts_at', start)
    .lte('starts_at', end)
    .order('starts_at', { ascending: true });

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      workshop_id: string;
      starts_at: string;
      timezone: string;
      capacity: number;
      reserved_count: number;
      price_gross_grosz: number | null;
      status: string;
      location_name: string | null;
      location_address: string | null;
      venue_key: string | null;
      booking_opens_at: string | null;
      booking_closes_at: string | null;
      workshops: {
        id: string;
        title: string;
        slug: string;
        status: string;
        archived_at: string | null;
        default_price_gross_grosz: number;
      };
    }>
  ).flatMap((session) => {
    const target = session.workshops;
    const remaining = session.capacity - session.reserved_count;
    if (
      !target ||
      target.status !== 'published' ||
      target.archived_at ||
      session.starts_at <= now ||
      (session.booking_opens_at && session.booking_opens_at > now) ||
      (session.booking_closes_at && session.booking_closes_at < now) ||
      remaining < quantity
    ) {
      return [];
    }
    return [
      {
        sessionId: session.id,
        workshopId: target.id,
        workshopSlug: target.slug,
        workshopTitle: target.title,
        startsAt: session.starts_at,
        timezone: session.timezone,
        venueKey: session.venue_key,
        locationName: session.location_name,
        locationAddress: session.location_address,
        remainingCapacity: remaining,
        unitPriceGrosz:
          session.price_gross_grosz ?? target.default_price_gross_grosz,
      },
    ];
  });
}

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
          'id, starts_at, timezone, capacity, reserved_count, price_gross_grosz, status, location_name, location_address, venue_key, booking_opens_at, booking_closes_at, workshops!inner(id, title, slug, status, archived_at, booking_mode, default_price_gross_grosz, minimum_age, maximum_age, participant_audience, collect_participant_age, offers_followup_session, requires_followup_session, followup_workshop_id, followup_workshop_type, followup_min_days, followup_max_days)'
        )
        .eq('id', line.sessionId)
        .maybeSingle();

      const workshop = session?.workshops as unknown as WorkshopMeta | null;
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

      const minimumAge = workshop?.minimum_age ?? null;
      const maximumAge = workshop?.maximum_age ?? null;
      const participantAudience = workshop?.participant_audience ?? 'adult';
      const collectParticipantAge =
        workshop?.collect_participant_age ?? participantAudience === 'child';
      const requiresFollowupSession = Boolean(
        workshop?.requires_followup_session && line.linkRole !== 'followup'
      );
      const offersFollowupSession = Boolean(
        (workshop?.offers_followup_session || requiresFollowupSession) &&
        line.linkRole !== 'followup'
      );
      const followupOptions =
        offersFollowupSession && session && workshop
          ? await loadFollowupOptions(
              supabase,
              workshop,
              session.starts_at,
              line.quantity,
              now
            )
          : [];
      if (requiresFollowupSession && followupOptions.length === 0) {
        issues.push(
          'Brak dostępnego terminu obowiązkowego szkliwienia. Wybierz inny termin lub skontaktuj się z pracownią.'
        );
      }

      const available = issues.every(
        (issue) => issue === 'Cena uległa zmianie — pokazujemy aktualną cenę.'
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
        minimumAge,
        maximumAge,
        ageRequired: participantAudience === 'child' && collectParticipantAge,
        participantAudience,
        collectParticipantAge,
        offersFollowupSession,
        requiresFollowupSession,
        followupWorkshopType: workshop?.followup_workshop_type ?? null,
        followupMinDays: workshop?.followup_min_days ?? null,
        followupMaxDays: workshop?.followup_max_days ?? null,
        followupOptions,
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
      (issue) => issue === 'Cena uległa zmianie — pokazujemy aktualną cenę.'
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
    (line) =>
      !line.available ||
      line.issues.some(
        (issue) => issue !== 'Cena uległa zmianie — pokazujemy aktualną cenę.'
      )
  );
  const subtotalGrosz = result.reduce(
    (sum, line) => sum + line.lineTotalGrosz,
    0
  );

  return {
    lines: result,
    subtotalGrosz,
    shippingQuoteRequired,
    canCheckout: result.length > 0 && !blocking,
  };
}
