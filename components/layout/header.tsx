import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from './theme-switch';
import { MobileNavigation } from './mobile-navigation';
import { primaryNavigation } from '@/lib/fixtures/navigation';
import { cn } from '@/lib/utils/cn';

const linkClasses =
  'rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-base hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-surface-subtle/30 bg-surface-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link
          href="/"
          className={cn(
            'font-heading text-xl font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
            'transition-base hover:text-accent-primary'
          )}
        >
          Ceramika Nero
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Nawigacja główna"
        >
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href} className={linkClasses}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeSwitch className="hidden lg:inline-flex" />
          <Button
            href="/warsztaty"
            variant="primary"
            className="hidden lg:inline-flex"
          >
            Zarezerwuj warsztat
          </Button>
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
