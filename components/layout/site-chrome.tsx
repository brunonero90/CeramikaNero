'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MobileContactFab } from '@/components/layout/mobile-contact-fab';

export type SiteChromeContact = {
  phoneHref: string;
  phoneDisplay: string;
  whatsappHref: string;
  facebookUrl?: string;
  instagramUrl?: string;
  publicNotice?: string;
};

/**
 * Public marketing chrome. Hidden on /admin so admin pages keep their own
 * operational shell without the public header/footer.
 */
export function SiteChrome({
  children,
  contact,
}: {
  children: React.ReactNode;
  contact?: SiteChromeContact;
}) {
  const pathname = usePathname() || '';
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Header
        facebookUrl={contact?.facebookUrl}
        instagramUrl={contact?.instagramUrl}
      />
      {contact?.publicNotice ? (
        <div
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
          role="status"
        >
          {contact.publicNotice}
        </div>
      ) : null}
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <MobileContactFab
        phoneHref={contact?.phoneHref}
        phoneDisplay={contact?.phoneDisplay}
        whatsappHref={contact?.whatsappHref}
      />
    </>
  );
}
