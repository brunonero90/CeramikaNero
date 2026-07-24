import Link from 'next/link';
import { NewsletterSignup } from '@/components/clone/newsletter-signup';
import { primaryNavigation, siteContact } from '@/lib/fixtures/navigation';

export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="bg-surface-bg px-4 py-12 text-center md:px-6">
        <p className="font-heading text-2xl font-semibold text-accent-primary md:text-3xl">
          {siteContact.brand}
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-text-muted md:text-base">
          ■ {siteContact.addressLine} ■ {siteContact.cityLine} ■{' '}
          <a
            href={`mailto:${siteContact.email}`}
            className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            {siteContact.email}
          </a>{' '}
          ■ tel.{' '}
          <a
            href={siteContact.phoneHref}
            className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            {siteContact.phoneDisplay}
          </a>
        </p>
        <p className="mt-2 text-sm text-text-muted">
          ■ Numer Konta: {siteContact.bankAccount} ■ NIP {siteContact.nip}
        </p>
        <nav
          aria-label="Nawigacja stopki"
          className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-4 gap-y-2"
        >
          {primaryNavigation.map((item) => (
            <Link
              key={`f-${item.href}-${item.label}`}
              href={item.href}
              className="text-xs font-semibold tracking-wide text-text-muted uppercase transition-base hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="bg-accent-primary px-4 py-12 text-white md:px-6">
        <NewsletterSignup />
        <div className="mx-auto mt-8 flex max-w-xl flex-col items-center justify-between gap-3 border-t border-white/20 pt-6 text-xs text-white/80 sm:flex-row">
          <p>© {new Date().getFullYear()} by Ceramika Nero.</p>
          <Link
            href={siteContact.privacyHref}
            className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Polityka prywatności
          </Link>
        </div>
      </div>
    </footer>
  );
}
