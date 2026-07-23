'use client';

import { useState } from 'react';
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

export function MobileNavigation({ role }: { role: AdminRole }) {
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter(
    (item) =>
      (!item.ownerOnly || role === 'owner') &&
      (!item.allowedRoles || item.allowedRoles.includes(role))
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-admin-nav"
        className="rounded-md border border-gray-300 p-2 text-sm"
      >
        Menu
      </button>
      {open && (
        <nav
          id="mobile-admin-nav"
          className="mt-2 flex flex-col gap-1 rounded-md border bg-white p-2 shadow"
        >
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
