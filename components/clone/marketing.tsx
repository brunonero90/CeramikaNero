import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type CloneCtaProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'outline';
};

/** Rectangular terracotta CTA matching archived marketing buttons. */
export function CloneCta({
  href,
  children,
  className,
  variant = 'primary',
}: CloneCtaProps) {
  const classes = cn(
    'inline-flex items-center justify-center px-6 py-3 text-sm font-semibold tracking-wide uppercase transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
    variant === 'primary' && 'bg-accent-primary text-white hover:brightness-95',
    variant === 'outline' &&
      'border border-accent-primary text-accent-primary hover:bg-accent-primary/10',
    className
  );

  if (
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('http://') ||
    href.startsWith('https://')
  ) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

type MarketingHeroProps = {
  title: string;
  imageSrc: string;
  imageAlt: string;
  logoSrc?: string;
  logoAlt?: string;
  intro?: string[];
};

export function MarketingHero({
  title,
  imageSrc,
  imageAlt,
  logoSrc,
  logoAlt,
  intro,
}: MarketingHeroProps) {
  return (
    <section className="bg-surface-bg">
      <div className="relative mx-auto max-w-5xl px-4 pt-6 md:px-6">
        <div className="relative overflow-hidden">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={980}
            height={523}
            className="h-auto w-full object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 980px"
          />
          {logoSrc && (
            <div className="absolute top-4 left-4 bg-accent-primary/90 p-2 text-white shadow-md md:top-6 md:left-6">
              <Image
                src={logoSrc}
                alt={logoAlt || 'Ceramika Nero'}
                width={120}
                height={100}
                className="h-16 w-auto object-contain md:h-20"
              />
            </div>
          )}
        </div>
        <div className="mx-auto max-w-3xl px-2 py-10 text-center md:py-14">
          <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl lg:text-5xl">
            {title}
          </h1>
          {intro?.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="mt-4 text-base leading-relaxed text-text-muted md:text-lg"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export type SplitBlock = {
  id: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullets?: string[];
  imageSrc: string;
  imageAlt: string;
  imageFirst?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  tinted?: boolean;
};

export function ImageTextSplit({ block }: { block: SplitBlock }) {
  const imageFirst = block.imageFirst ?? true;
  return (
    <section
      className={cn(
        'border-t border-surface-subtle/40',
        block.tinted ? 'bg-[#f8ebe3]' : 'bg-surface-bg'
      )}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12 md:px-6 md:py-14">
        <div className={cn('relative', !imageFirst && 'md:order-2')}>
          <Image
            src={block.imageSrc}
            alt={block.imageAlt}
            width={488}
            height={720}
            className="h-auto w-full object-cover"
            sizes="(max-width: 768px) 100vw, 488px"
          />
        </div>
        <div className={cn(!imageFirst && 'md:order-1')}>
          <h2 className="font-heading text-2xl font-semibold tracking-wide text-text-primary uppercase md:text-3xl">
            {block.title}
          </h2>
          {block.subtitle && (
            <p className="mt-2 text-sm font-medium tracking-wide text-accent-primary uppercase">
              {block.subtitle}
            </p>
          )}
          {block.paragraphs?.map((p) => (
            <p
              key={p.slice(0, 48)}
              className="mt-4 text-base leading-relaxed text-text-muted"
            >
              {p}
            </p>
          ))}
          {block.bullets && block.bullets.length > 0 && (
            <ul className="mt-5 space-y-2 text-base text-text-primary">
              {block.bullets.map((item) => (
                <li key={item.slice(0, 60)} className="flex gap-2">
                  <span className="mt-1 text-accent-primary" aria-hidden>
                    ■
                  </span>
                  <span>{item.replace(/^■\s*/, '')}</span>
                </li>
              ))}
            </ul>
          )}
          {block.ctaLabel && block.ctaHref && (
            <div className="mt-8">
              <CloneCta href={block.ctaHref}>{block.ctaLabel}</CloneCta>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
