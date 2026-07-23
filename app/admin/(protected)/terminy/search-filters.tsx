'use client';

import Link from 'next/link';

export function SearchFilters({
  workshop,
  status,
  instructor,
  dateFrom,
  dateTo,
  workshops,
  instructors,
}: {
  workshop: string;
  status: string;
  instructor: string;
  dateFrom: string;
  dateTo: string;
  workshops: { id: string; title: string }[];
  instructors: { id: string; display_name: string }[];
}) {
  return (
    <form method="GET" className="rounded-lg border bg-white p-4">
      <div className="grid items-end gap-3 sm:grid-cols-6">
        <div>
          <label htmlFor="workshop" className="block text-sm font-medium">
            Warsztat
          </label>
          <select
            id="workshop"
            name="workshop"
            defaultValue={workshop}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Wszystkie</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
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
            <option value="scheduled">Planowany</option>
            <option value="sold_out">Wyprzedany</option>
            <option value="cancelled">Odwołany</option>
            <option value="completed">Zakończony</option>
          </select>
        </div>
        <div>
          <label htmlFor="instructor" className="block text-sm font-medium">
            Instruktor
          </label>
          <select
            id="instructor"
            name="instructor"
            defaultValue={instructor}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Wszyscy</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dateFrom" className="block text-sm font-medium">
            Od
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="dateTo" className="block text-sm font-medium">
            Do
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={dateTo}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Filtruj
          </button>
          <Link
            href="/admin/terminy"
            className="rounded-md border px-4 py-2 text-sm"
          >
            Wyczyść
          </Link>
        </div>
      </div>
    </form>
  );
}
