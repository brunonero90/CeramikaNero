import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { resolveCtaHref } from '@/lib/clone/link-resolve';

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
  const resolved = resolveCtaHref(
    typeof children === 'string' ? children : '',
    href
  );
  const target = resolved.actionable ? resolved.href : href;
  const classes = cn(
    'inline-flex items-center justify-center px-6 py-3 text-sm font-medium tracking-wide transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
    variant === 'primary' && 'bg-accent-primary text-white hover:brightness-95',
    variant === 'outline' &&
      'border border-accent-primary text-accent-primary hover:bg-accent-primary/10',
    className
  );

  if (!resolved.actionable && (href === '#' || !href)) {
    return (
      <span className={cn(classes, 'cursor-default opacity-60')} role="text">
        {children}
      </span>
    );
  }

  if (
    target.startsWith('mailto:') ||
    target.startsWith('tel:') ||
    target.startsWith('http://') ||
    target.startsWith('https://')
  ) {
    return (
      <a href={target} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={target} className={classes}>
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
    <section className="bg-[#fbe5d6]/35">
      <div className="relative mx-auto w-full max-w-[980px] px-0 pt-0 md:px-0">
        <div className="relative overflow-hidden">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={980}
            height={523}
            className="aspect-[980/523] h-auto w-full object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 980px"
          />
          {logoSrc && (
            <div className="absolute top-4 left-4 md:top-8 md:left-8">
              <Image
                src={logoSrc}
                alt={logoAlt || 'Ceramika Nero'}
                width={153}
                height={133}
                className="h-[88px] w-auto object-contain md:h-[133px]"
              />
            </div>
          )}
        </div>
        <div className="mx-auto max-w-[720px] px-4 py-6 text-center md:px-6 md:py-8">
          <h1 className="font-heading text-[1.85rem] font-semibold leading-tight text-[#a85a48] md:text-[2.35rem]">
            {title.split('\n').map((line, i, arr) => (
              <span
                key={i}
                className={
                  i > 0 ? 'mt-1 block text-[0.88em] font-medium' : undefined
                }
              >
                {line}
                {i < arr.length - 1 ? <br /> : null}
              </span>
            ))}
          </h1>
          {intro?.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="mt-2.5 text-[14px] leading-[1.65] text-[#5c4038] md:text-[15px]"
            >
              {paragraph.split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
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
  /** Archive display crop (Wix fill w/h). Prevents intrinsic-height explosions. */
  imageWidth?: number;
  imageHeight?: number;
  ctaLabel?: string;
  ctaHref?: string;
  tinted?: boolean;
  /** Center title/body like original package cards. */
  textAlign?: 'left' | 'center';
  /** Draw a thin border around the text panel (panieńskie packages). */
  framed?: boolean;
  /** Tighter vertical rhythm for event package pages. */
  compact?: boolean;
};

export function ImageTextSplit({ block }: { block: SplitBlock }) {
  const imageFirst = block.imageFirst ?? true;
  const align = block.textAlign ?? 'left';
  const imgW = block.imageWidth ?? 488;
  const imgH = block.imageHeight ?? 720;
  return (
    <section className={cn(block.tinted ? 'bg-[#f8ebe3]' : 'bg-[#fdf8f4]')}>
      <div
        className={cn(
          'mx-auto grid max-w-[980px] items-start gap-5 px-4 md:grid-cols-2 md:gap-6 md:px-0',
          block.compact ? 'py-2 md:py-2.5' : 'py-8 md:py-10'
        )}
      >
        <div className={cn('relative w-full', !imageFirst && 'md:order-2')}>
          <Image
            src={block.imageSrc}
            alt={block.imageAlt}
            width={imgW}
            height={imgH}
            className="h-auto w-full object-cover"
            style={{ aspectRatio: `${imgW} / ${imgH}` }}
            sizes="(max-width: 768px) 100vw, 488px"
          />
        </div>
        <div
          className={cn(
            !imageFirst && 'md:order-1',
            block.framed &&
              'border border-[#5c4038]/25 px-5 py-5 md:px-7 md:py-7',
            align === 'center' && 'text-center'
          )}
        >
          <h2
            className={cn(
              'font-heading text-[1.55rem] font-semibold leading-snug tracking-wide text-[#a85a48] md:text-[1.85rem]',
              align === 'center' && 'text-center'
            )}
          >
            {block.title.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 ? <br /> : null}
              </span>
            ))}
          </h2>
          {block.subtitle && (
            <p className="mt-2 text-sm font-medium tracking-wide text-[#a85a48] uppercase">
              {block.subtitle.split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          )}
          {block.paragraphs?.map((p) => (
            <p
              key={p.slice(0, 48)}
              className="mt-3 text-[14px] leading-[1.65] text-[#5c4038] md:text-[15px]"
            >
              {p.split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          ))}
          {block.bullets && block.bullets.length > 0 && (
            <ul
              className={cn(
                'mt-4 space-y-1.5 text-[14px] text-[#3d2a24] md:text-[15px]',
                align === 'center' && 'inline-block text-left'
              )}
            >
              {block.bullets.map((item) => (
                <li key={item.slice(0, 60)} className="flex gap-2">
                  <span className="mt-1 text-[#a85a48]" aria-hidden>
                    ■
                  </span>
                  <span>
                    {item
                      .replace(/^■\s*/, '')
                      .split('\n')
                      .map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 ? <br /> : null}
                        </span>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {block.ctaLabel &&
            block.ctaHref &&
            (() => {
              const resolved = resolveCtaHref(block.ctaLabel, block.ctaHref);
              if (!resolved.actionable) return null;
              return (
                <div
                  className={cn(
                    'mt-5',
                    align === 'center' && 'flex justify-center'
                  )}
                >
                  <CloneCta href={resolved.href}>{block.ctaLabel}</CloneCta>
                </div>
              );
            })()}
        </div>
      </div>
    </section>
  );
}
