'use client';

import { useActionState } from 'react';
import type { SessionActionState } from './actions';
import type { Workshop, Instructor, SessionStatus } from '@/lib/database/types';

type SessionFormData = {
  workshopId: string;
  instructorId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: number;
  priceGrossPln: number;
  locationName: string;
  locationAddress: string;
  status: SessionStatus;
  bookingOpensDate: string;
  bookingOpensTime: string;
  bookingClosesDate: string;
  bookingClosesTime: string;
  externalBookingUrl: string;
};

export function SessionForm({
  action,
  initialData,
  workshops,
  instructors,
  submitLabel,
}: {
  action: (
    prevState: SessionActionState | undefined,
    formData: FormData
  ) => Promise<SessionActionState>;
  initialData?: Partial<SessionFormData>;
  workshops: Workshop[];
  instructors: Instructor[];
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState(action, undefined);

  const defaultData: SessionFormData = {
    workshopId: '',
    instructorId: null,
    date: '',
    startTime: '10:00',
    endTime: '12:00',
    timezone: 'Europe/Warsaw',
    capacity: 10,
    priceGrossPln: 0,
    locationName: '',
    locationAddress: '',
    status: 'draft',
    bookingOpensDate: '',
    bookingOpensTime: '',
    bookingClosesDate: '',
    bookingClosesTime: '',
    externalBookingUrl: '',
    ...initialData,
  };

  const errorFor = (path: string): string | undefined =>
    state && !state.ok ? state.errors[path] : undefined;

  return (
    <form action={dispatch} className="max-w-2xl space-y-4">
      {state?.ok && (
        <p
          className="rounded-md bg-green-50 p-3 text-sm text-green-700"
          role="status"
        >
          {state.message}
        </p>
      )}
      {!state?.ok && state?.formError && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {state.formError}
        </p>
      )}

      <div>
        <label htmlFor="workshopId" className="block text-sm font-medium">
          Warsztat
        </label>
        <select
          id="workshopId"
          name="workshopId"
          defaultValue={defaultData.workshopId}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">Wybierz warsztat</option>
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
        {errorFor('workshopId') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('workshopId')}</p>
        )}
      </div>

      <div>
        <label htmlFor="instructorId" className="block text-sm font-medium">
          Instruktor
        </label>
        <select
          id="instructorId"
          name="instructorId"
          defaultValue={defaultData.instructorId ?? ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">Brak</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.displayName}
            </option>
          ))}
        </select>
        {errorFor('instructorId') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('instructorId')}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-medium">
            Data
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={defaultData.date}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
          {errorFor('date') && (
            <p className="mt-1 text-sm text-red-600">{errorFor('date')}</p>
          )}
        </div>
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium">
            Strefa czasowa
          </label>
          <input
            id="timezone"
            name="timezone"
            type="text"
            defaultValue={defaultData.timezone}
            readOnly
            className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
          />
          <p className="text-xs text-gray-500">
            Czas wprowadzany jest w czasie lokalnym.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium">
            Godzina rozpoczęcia
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={defaultData.startTime}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
          {errorFor('startsAt') && (
            <p className="mt-1 text-sm text-red-600">{errorFor('startsAt')}</p>
          )}
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium">
            Godzina zakończenia
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={defaultData.endTime}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
          {errorFor('endsAt') && (
            <p className="mt-1 text-sm text-red-600">{errorFor('endsAt')}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="capacity" className="block text-sm font-medium">
            Liczba miejsc
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={defaultData.capacity}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
          {errorFor('capacity') && (
            <p className="mt-1 text-sm text-red-600">{errorFor('capacity')}</p>
          )}
        </div>
        <div>
          <label htmlFor="priceGrossPln" className="block text-sm font-medium">
            Cena brutto (PLN)
          </label>
          <input
            id="priceGrossPln"
            name="priceGrossPln"
            type="number"
            min={0}
            step={0.01}
            defaultValue={defaultData.priceGrossPln}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="locationName" className="block text-sm font-medium">
            Nazwa miejsca
          </label>
          <input
            id="locationName"
            name="locationName"
            type="text"
            defaultValue={defaultData.locationName}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="locationAddress"
            className="block text-sm font-medium"
          >
            Adres
          </label>
          <input
            id="locationAddress"
            name="locationAddress"
            type="text"
            defaultValue={defaultData.locationAddress}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultData.status}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="draft">Szkic</option>
          <option value="scheduled">Planowany</option>
          <option value="sold_out">Wyprzedany</option>
          <option value="cancelled">Odwołany</option>
          <option value="completed">Zakończony</option>
        </select>
        {errorFor('status') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('status')}</p>
        )}
      </div>

      <div className="rounded-md border bg-gray-50 p-3">
        <p className="mb-2 text-sm font-medium">Okno zapisów</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium">Otwarcie — data</label>
            <input
              type="date"
              name="bookingOpensDate"
              defaultValue={defaultData.bookingOpensDate}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">
              Otwarcie — godzina
            </label>
            <input
              type="time"
              name="bookingOpensTime"
              defaultValue={defaultData.bookingOpensTime}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">
              Zamknięcie — data
            </label>
            <input
              type="date"
              name="bookingClosesDate"
              defaultValue={defaultData.bookingClosesDate}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">
              Zamknięcie — godzina
            </label>
            <input
              type="time"
              name="bookingClosesTime"
              defaultValue={defaultData.bookingClosesTime}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
        {errorFor('bookingOpensAt') && (
          <p className="mt-2 text-sm text-red-600">
            {errorFor('bookingOpensAt')}
          </p>
        )}
        {errorFor('bookingClosesAt') && (
          <p className="mt-2 text-sm text-red-600">
            {errorFor('bookingClosesAt')}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="externalBookingUrl"
          className="block text-sm font-medium"
        >
          Zewnętrzny link do rezerwacji
        </label>
        <input
          id="externalBookingUrl"
          name="externalBookingUrl"
          type="url"
          defaultValue={defaultData.externalBookingUrl}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('externalBookingUrl') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('externalBookingUrl')}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Zapisywanie…' : submitLabel}
      </button>
    </form>
  );
}
