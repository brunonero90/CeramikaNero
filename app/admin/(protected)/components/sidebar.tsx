import Link from 'next/link';
import type { AdminRole } from '@/lib/database/types';

type NavItem = {
  href: string;
  label: string;
  ownerOnly?: boolean;
  allowedRoles?: AdminRole[];
};

const navItems: NavItem[] = [
  { href: '/admin', label: 'Pulpit' },
  {
    href: '/admin/kategorie',
    label: 'Kategorie',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/warsztaty',
    label: 'Warsztaty',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/terminy',
    label: 'Terminy',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/rezerwacje',
    label: 'Rezerwacje',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/zamowienia',
    label: 'Zamówienia',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/produkty',
    label: 'Produkty',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/zapytania',
    label: 'Zapytania',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/emaile',
    label: 'E-maile',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/instruktorzy',
    label: 'Instruktorzy',
    allowedRoles: ['owner', 'manager'],
  },
  {
    href: '/admin/strony',
    label: 'Strony',
    allowedRoles: ['owner', 'manager', 'editor'],
  },
  {
    href: '/admin/blog',
    label: 'Blog',
    allowedRoles: ['owner', 'manager', 'editor'],
  },
  {
    href: '/admin/galeria',
    label: 'Galeria',
    allowedRoles: ['owner', 'manager', 'editor'],
  },
  {
    href: '/admin/media',
    label: 'Media',
    allowedRoles: ['owner', 'manager', 'editor'],
  },
  { href: '/admin/ustawienia', label: 'Ustawienia', ownerOnly: true },
  { href: '/admin/przekierowania', label: 'Przekierowania', ownerOnly: true },
  { href: '/admin/uzytkownicy', label: 'Użytkownicy', ownerOnly: true },
  { href: '/admin/audyt', label: 'Audyt', ownerOnly: true },
];

export function Sidebar({ role }: { role: AdminRole }) {
  const visibleItems = navItems.filter(
    (item) =>
      (!item.ownerOnly || role === 'owner') &&
      (!item.allowedRoles || item.allowedRoles.includes(role))
  );

  return (
    <nav className="hidden w-64 flex-shrink-0 flex-col gap-1 border-r bg-white p-4 md:flex">
      <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Administracja
      </p>
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
