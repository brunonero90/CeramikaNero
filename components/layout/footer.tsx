import Link from 'next/link';
import { NewsletterSignup } from '@/components/clone/newsletter-signup';
import { siteContact } from '@/lib/fixtures/navigation';

/**
 * Shared Wix footer — archive geometry ~483px @1440 (page-spec footer section).
 * Peach band #fbe5d6 → terracotta panel #7e402e (~980px) → © 2023.
 */
export function Footer() {
  return (
    <footer
      className="mt-auto bg-[#fbe5d6] text-[#5c4038]"
      data-chrome="site-footer"
    >
      <div className="px-4 pt-8 pb-5 text-center md:px-6 md:pt-9 md:pb-6">
        <p className="font-heading text-[26px] font-normal tracking-wide text-[#a85a48] md:text-[30px]">
          {siteContact.brand}
        </p>
        <p className="mx-auto mt-4 max-w-[780px] text-[13px] leading-[1.65] md:text-[14px]">
          <span className="inline-block px-0.5 text-[#a85a48]" aria-hidden>
            ■
          </span>{' '}
          {siteContact.addressLine}{' '}
          <span className="inline-block px-0.5 text-[#a85a48]" aria-hidden>
            ■
          </span>{' '}
          {siteContact.cityLine}{' '}
          <span className="inline-block px-0.5 text-[#a85a48]" aria-hidden>
            ■
          </span>{' '}
          <a
            href={`mailto:${siteContact.email}`}
            className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            {siteContact.email}
          </a>{' '}
          <span className="inline-block px-0.5 text-[#a85a48]" aria-hidden>
            ■
          </span>{' '}
          tel.{' '}
          <a
            href={siteContact.phoneHref}
            className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            {siteContact.phoneDisplay.replace(/\s/g, '')}
          </a>
        </p>
        <p className="mx-auto mt-1 max-w-[780px] text-[13px] leading-[1.65] md:text-[14px]">
          <span className="inline-block px-0.5 text-[#a85a48]" aria-hidden>
            ■
          </span>{' '}
          Numer Konta: {siteContact.bankAccount}{' '}
          <span className="inline-block px-0.5 text-[#a85a48]" aria-hidden>
            ■
          </span>{' '}
          NIP {siteContact.nip}
        </p>
      </div>

      <div className="px-4 pb-5 md:px-6 md:pb-6">
        <div className="mx-auto w-full max-w-[980px] bg-[#7e402e] px-5 py-6 text-[#fdf2ed] md:px-10 md:py-7">
          <NewsletterSignup variant="wix-panel" />
          <div className="mt-5 text-right">
            <Link
              href={siteContact.privacyHref}
              className="text-sm text-[#fdf2ed] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Polityka prywatności
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 text-center md:px-6 md:pb-7">
        <p className="text-sm text-[#5c4038] underline underline-offset-2">
          © 2023 by Ceramika Nero.
        </p>
      </div>
    </footer>
  );
}
