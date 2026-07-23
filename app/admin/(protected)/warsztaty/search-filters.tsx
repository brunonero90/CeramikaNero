'use client';

import Link from 'next/link';

export function SearchFilters({
  q,
  category,
  status,
  categories,
}: {
  q: string;
  category: string;
  status: string;
  categories: { id: string; name: string }[];
}) {
  return (
    <form method="GET" className="rounded-lg border bg-white p-4">
      <div className="grid items-end gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="block text-sm font-medium">
            Szukaj
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Tytuł lub slug"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium">
            Kategoria
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Wszystkie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Wszystkie</option>
            <option value="draft">Szkic</option>
            <option value="published">Opublikowany</option>
            <option value="archived">Zarchiwizowany</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Filtruj
          </button>
          <Link
            href="/admin/warsztaty"
            className="rounded-md border px-4 py-2 text-sm"
          >
            Wyczyść
          </Link>
        </div>
      </div>
    </form>
  );
}
