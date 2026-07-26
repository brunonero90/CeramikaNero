import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface-bg text-text-primary', className)}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: 'default' | 'raised' | 'warm';
}) {
  return (
    <section
      id={id}
      className={cn(
        'px-4 py-12 md:px-6 md:py-16',
        tone === 'raised' && 'bg-surface-raised',
        tone === 'warm' && 'bg-[#f8ebe3]',
        className
      )}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-2xl text-center')}>
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.18em] text-accent-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-heading text-3xl font-semibold text-text-primary md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center justify-center bg-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase transition-base hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center justify-center border border-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-accent-primary uppercase transition-base hover:bg-accent-highlight/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        tone === 'neutral' && 'bg-surface-subtle text-text-muted',
        tone === 'ok' && 'bg-emerald-50 text-emerald-800',
        tone === 'warn' && 'bg-amber-50 text-amber-900',
        tone === 'danger' && 'bg-red-50 text-red-800'
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-surface-subtle/60 bg-surface-raised px-6 py-10 text-center">
      <p className="font-heading text-xl font-semibold text-text-primary">
        {title}
      </p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
