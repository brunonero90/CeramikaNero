import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { AddToCartButton } from '@/components/clone/add-to-cart-button';
import { glinaBoxCommerce } from '@/lib/clone/content/glina-box-commerce';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: glinaBoxCommerce.title,
  description: glinaBoxCommerce.metaDescription,
};

type ProductRow = {
  id: string;
  sku: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  product_type: 'physical_product' | 'studio_service';
  price_gross_grosz: number;
  compare_at_price_gross_grosz: number | null;
  images: Array<{ src?: string; alt?: string }> | null;
  requires_shipping: boolean;
  allows_pickup: boolean;
  shipping_fee_mode: string;
};

export default async function GlinaBoxHomePage() {
  // Cart tables land in generated types after migrations 11–12 + db:types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: products } = await supabase
    .from('products')
    .select(
      'id, sku, slug, title, short_description, description, product_type, price_gross_grosz, compare_at_price_gross_grosz, images, requires_shipping, allows_pickup, shipping_fee_mode'
    )
    .eq('status', 'published')
    .is('archived_at', null)
    .in('slug', ['glina-box', 'szkliwienie-prac-w-pracowni'])
    .order('sku');

  const list = (products ?? []) as ProductRow[];
  const glinaBox = list.find((p) => p.slug === 'glina-box');
  const firing = list.find((p) => p.slug === 'szkliwienie-prac-w-pracowni');
  const heroImage =
    glinaBox?.images?.[0]?.src ??
    '/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg';

  return (
    <div className="bg-[#fdf8f4]">
      <section className="relative min-h-[42vh] w-full overflow-hidden">
        <Image
          src={heroImage}
          alt="Glina Box — zestaw do lepienia z gliny"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative mx-auto flex min-h-[42vh] max-w-3xl flex-col justify-end px-4 pb-10 text-white md:px-6">
          <h1 className="font-heading text-4xl font-semibold md:text-5xl">
            {glinaBoxCommerce.heroTitle}
          </h1>
          <p className="mt-3 max-w-xl text-base md:text-lg">
            {glinaBoxCommerce.heroLead}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-4 py-10 md:px-6">
        {glinaBoxCommerce.intro.map((p) => (
          <p key={p} className="leading-relaxed text-text-primary">
            {p}
          </p>
        ))}
      </section>

      <section className="mx-auto grid max-w-3xl gap-8 px-4 pb-10 md:grid-cols-2 md:px-6">
        <div>
          <h2 className="font-heading text-2xl font-semibold">
            {glinaBoxCommerce.forWhomTitle}
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-text-muted">
            {glinaBoxCommerce.forWhom.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-heading text-2xl font-semibold">
            {glinaBoxCommerce.containsTitle}
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-text-muted">
            {glinaBoxCommerce.contains.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10 md:px-6">
        <h2 className="font-heading text-2xl font-semibold">
          {glinaBoxCommerce.afterTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-text-muted">
          {glinaBoxCommerce.after.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-text-muted">
          {glinaBoxCommerce.logisticsNote}
        </p>
      </section>

      <section className="border-t border-surface-subtle/40 bg-white px-4 py-10 md:px-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="font-heading text-2xl font-semibold">Zamówienie</h2>
          {!glinaBox && !firing ? (
            <p className="text-sm text-amber-900">
              Produkty pojawią się po wdrożeniu katalogu. W międzyczasie napisz
              przez{' '}
              <Link href="/kontakt" className="underline">
                kontakt
              </Link>
              .
            </p>
          ) : null}

          {glinaBox ? (
            <article className="space-y-4 border border-surface-subtle p-5">
              <div className="relative aspect-[4/3] max-w-md overflow-hidden">
                <Image
                  src={
                    glinaBox.images?.[0]?.src ??
                    '/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg'
                  }
                  alt={glinaBox.images?.[0]?.alt ?? glinaBox.title}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 420px"
                />
              </div>
              <h3 className="text-xl font-semibold">{glinaBox.title}</h3>
              <p className="text-sm text-text-muted">
                {glinaBox.short_description}
              </p>
              <p className="text-lg font-semibold">
                {formatPrice(glinaBox.price_gross_grosz)}
              </p>
              <p className="text-xs text-text-muted">
                {glinaBoxCommerce.priceNote}
              </p>
              {glinaBox.shipping_fee_mode === 'quote_required' ? (
                <p className="text-sm text-amber-900">
                  Przy wysyłce do domu koszt dostawy potwierdzimy przed
                  płatnością — nie pokazujemy sztucznej kwoty.
                </p>
              ) : null}
              <AddToCartButton
                productId={glinaBox.id}
                sku={glinaBox.sku}
                slug={glinaBox.slug}
                title={glinaBox.title}
                unitPriceGrosz={glinaBox.price_gross_grosz}
                productType="physical_product"
                requiresShipping={glinaBox.requires_shipping}
                allowsPickup={glinaBox.allows_pickup}
              />
            </article>
          ) : null}

          {firing ? (
            <article className="space-y-4 border border-surface-subtle p-5">
              <h3 className="text-xl font-semibold">{firing.title}</h3>
              <p className="text-sm text-text-muted">
                {firing.short_description}
              </p>
              <p className="text-lg font-semibold">
                {formatPrice(firing.price_gross_grosz)}
              </p>
              <p className="text-sm text-text-muted">
                Usługa opcjonalna — nie jest wliczona w cenę Glina Box.
              </p>
              <AddToCartButton
                productId={firing.id}
                sku={firing.sku}
                slug={firing.slug}
                title={firing.title}
                unitPriceGrosz={firing.price_gross_grosz}
                productType="studio_service"
                requiresShipping={firing.requires_shipping}
                allowsPickup={firing.allows_pickup}
              />
            </article>
          ) : null}

          <p className="text-sm text-text-muted">
            Pytania?{' '}
            <Link href={glinaBoxCommerce.contactHref} className="underline">
              Skontaktuj się z nami
            </Link>
            . Zobacz też{' '}
            <Link href={glinaBoxCommerce.legalHref} className="underline">
              regulamin
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
