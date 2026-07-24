import Image from 'next/image';
import Link from 'next/link';
import { primaryNavigation } from '@/lib/fixtures/navigation';
import { getSocialIcon } from '@/lib/media/wix-catalog';

const footerLinks = [
  { label: 'Polityka prywatności', href: '/polityka-prywatnosci' },
  { label: 'Regulamin', href: '/regulamin' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();
  const facebook = getSocialIcon('facebook');
  const instagram = getSocialIcon('instagram');

  return (
    <footer className="mt-auto border-t border-surface-subtle/30 bg-surface-raised">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-heading text-lg font-semibold text-text-primary">
              Ceramika Nero
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Pracownia ceramiczna w Suchym Lesie.
              <br />
              Warsztaty dla dzieci, dorosłych i grup.
            </p>
            <div className="mt-4 flex items-center gap-3">
              {facebook && (
                <a
                  href="https://www.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  aria-label="Facebook Ceramika Nero"
                >
                  <Image
                    src={facebook.src}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                  />
                </a>
              )}
              {instagram && (
                <a
                  href="https://www.instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  aria-label="Instagram Ceramika Nero"
                >
                  <Image
                    src={instagram.src}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                  />
                </a>
              )}
            </div>
          </div>

          <nav aria-label="Nawigacja stopki">
            <ul className="space-y-2">
              {primaryNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-muted transition-base hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-sm font-medium text-text-primary">Kontakt</p>
            <address className="mt-2 not-italic text-sm text-text-muted">
              <p>Suchy Las, Polska</p>
              <p className="mt-1">e-mail: kontakt@ceramikanero.com</p>
              <p>tel: +48 TBD</p>
            </address>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-surface-subtle/30 pt-6 sm:flex-row">
          <p className="text-sm text-text-muted">
            © {currentYear} Ceramika Nero. Wszystkie prawa zastrzeżone.
          </p>
          <div className="flex gap-4">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-text-muted transition-base hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
