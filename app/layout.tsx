import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, Nunito, Quicksand } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { ThemeScript } from '@/lib/theme/theme-script';
import { SiteChrome } from '@/components/layout/site-chrome';
import { LocalCartProvider } from '@/components/clone/local-cart';
import { getPublicSettings } from '@/lib/database/services/site-settings';
import { contactDisplayFromSettings } from '@/lib/public/contact-display';
import './globals.css';

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const quicksand = Quicksand({
  variable: '--font-quicksand',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: 'Ceramika Nero — Warsztaty ceramiczne w Suchym Lesie',
    template: '%s | Ceramika Nero',
  },
  description:
    'Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w naszej pracowni w Suchym Lesie.',
  keywords: [
    'ceramika',
    'warsztaty ceramiczne',
    'Suchy Las',
    'glina',
    'rękodzieło',
    'pracownia ceramiczna',
  ],
  openGraph: {
    title: 'Ceramika Nero',
    description:
      'Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w Suchym Lesie.',
    siteName: 'Ceramika Nero',
    locale: 'pl_PL',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let contact;
  try {
    const settings = await getPublicSettings();
    const display = contactDisplayFromSettings(settings);
    contact = {
      phoneHref: display.phoneHref,
      phoneDisplay: display.phoneDisplay,
      whatsappHref: display.whatsappWithMessage,
      facebookUrl: display.facebookUrl,
      instagramUrl: display.instagramUrl,
      publicNotice: display.publicNotice || undefined,
    };
  } catch {
    contact = undefined;
  }

  return (
    <html
      lang="pl"
      className={`${cormorant.variable} ${inter.variable} ${quicksand.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-bg font-body text-text-primary">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-text-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Przejdź do treści
        </a>
        <ThemeScript />
        <ThemeProvider>
          <LocalCartProvider>
            <SiteChrome contact={contact}>{children}</SiteChrome>
          </LocalCartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
