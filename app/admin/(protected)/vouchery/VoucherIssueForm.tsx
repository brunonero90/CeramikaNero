'use client';

import { useActionState } from 'react';
import { issueVoucherAction, type VoucherIssueState } from './actions';

const initialVoucherIssueState: VoucherIssueState = { ok: false };

export function VoucherIssueForm() {
  const [state, action, pending] = useActionState(
    issueVoucherAction,
    initialVoucherIssueState
  );

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold">Wystaw / importuj bon</h2>
        <p className="text-sm text-gray-600">
          Zostaw kod pusty, aby wygenerować bezpieczny kod Ceramika Nero. Dla
          Prezent Marzeń wpisz kod otrzymany od partnera.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Wystawca
          <select name="providerCode" className="mt-1 w-full border px-3 py-2">
            <option value="ceramika_nero">Ceramika Nero</option>
            <option value="prezent_marzen">Prezent Marzeń</option>
          </select>
        </label>
        <label className="text-sm">
          Typ
          <select name="voucherType" className="mt-1 w-full border px-3 py-2">
            <option value="fixed_amount">Kwotowy</option>
            <option value="workshop_specific">Na określone warsztaty</option>
            <option value="experience">Jednorazowe doświadczenie</option>
          </select>
        </label>
        <label className="text-sm">
          Kod (opcjonalnie)
          <input
            name="code"
            className="mt-1 w-full border px-3 py-2 font-mono uppercase"
            autoComplete="off"
            maxLength={120}
          />
        </label>
        <label className="text-sm">
          Wartość (PLN)
          <input
            required
            name="valuePln"
            inputMode="decimal"
            placeholder="250,00"
            className="mt-1 w-full border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Ważny od
          <input
            name="validFrom"
            type="datetime-local"
            className="mt-1 w-full border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Ważny do
          <input
            name="validUntil"
            type="datetime-local"
            className="mt-1 w-full border px-3 py-2"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Opis
          <input
            name="description"
            maxLength={500}
            className="mt-1 w-full border px-3 py-2"
            placeholder="Np. Glina do Wina dla dwóch osób"
          />
        </label>
        <label className="text-sm">
          Dozwolone typy warsztatów
          <textarea
            name="allowedWorkshopTypes"
            rows={3}
            className="mt-1 w-full border px-3 py-2"
            placeholder="Slug kategorii, po przecinku lub w osobnych wierszach"
          />
        </label>
        <label className="text-sm">
          Dozwolone ID warsztatów
          <textarea
            name="allowedWorkshopIds"
            rows={3}
            className="mt-1 w-full border px-3 py-2 font-mono text-xs"
            placeholder="UUID, po przecinku lub w osobnych wierszach"
          />
        </label>
        <label className="text-sm">
          Zwrot wartości bonu
          <select name="refundPolicy" className="mt-1 w-full border px-3 py-2">
            <option value="restore">Przywróć saldo na tym samym bonie</option>
            <option value="replacement">Wystaw nowy bon Ceramika Nero</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input name="multiUse" type="checkbox" defaultChecked />
          Można używać wielokrotnie do wyczerpania salda
        </label>
      </div>

      {state.message ? (
        <div
          className={`rounded px-3 py-2 text-sm ${
            state.ok
              ? 'bg-green-50 text-green-900'
              : 'bg-red-50 text-red-800'
          }`}
        >
          <p>{state.message}</p>
          {state.issuedCode ? (
            <p className="mt-2 select-all font-mono text-base font-semibold">
              {state.issuedCode}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Zapisywanie…' : 'Zapisz bon'}
      </button>
    </form>
  );
}
