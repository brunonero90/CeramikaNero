'use client';

import { useActionState } from 'react';
import type { SettingsActionState } from './actions';

type SettingsFormData = {
  studioName: string;
  studioAddress: string;
  studioEmail: string;
  studioPhone: string;
  whatsappUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  bankTransferInstructions: string;
  deliveryQuoteWording: string;
  publicNotice: string;
  bookingCtaLabel: string;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
};

export function SettingsForm({
  action,
  initialData,
}: {
  action: (
    prevState: SettingsActionState | undefined,
    formData: FormData
  ) => Promise<SettingsActionState>;
  initialData: SettingsFormData;
}) {
  const [state, dispatch, isPending] = useActionState<
    SettingsActionState | undefined,
    FormData
  >(action, undefined);

  const errorFor = (field: string): string | undefined => {
    if (!state || state.ok) return undefined;
    return state.errors[field];
  };

  return (
    <form action={dispatch} className="max-w-3xl space-y-4">
      <p className="text-sm text-gray-600">
        Pola oznaczone jako publiczne mogą pojawić się na stronie i w e-mailach.
        Nie przechowuj tu kluczy API ani sekretów.
      </p>
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
      <Field
        id="studioName"
        label="Nazwa pracowni (publiczne)"
        defaultValue={initialData.studioName}
        error={errorFor('studioName')}
      />
      <Field
        id="studioAddress"
        label="Adres (publiczne)"
        defaultValue={initialData.studioAddress}
        error={errorFor('studioAddress')}
      />
      <Field
        id="studioEmail"
        label="Email (publiczne)"
        type="email"
        defaultValue={initialData.studioEmail}
        error={errorFor('studioEmail')}
      />
      <Field
        id="studioPhone"
        label="Telefon (publiczne)"
        defaultValue={initialData.studioPhone}
        error={errorFor('studioPhone')}
      />
      <Field
        id="whatsappUrl"
        label="WhatsApp URL (publiczne)"
        defaultValue={initialData.whatsappUrl}
        error={errorFor('whatsappUrl')}
      />
      <Field
        id="facebookUrl"
        label="Facebook URL (publiczne)"
        defaultValue={initialData.facebookUrl}
        error={errorFor('facebookUrl')}
      />
      <Field
        id="instagramUrl"
        label="Instagram URL (publiczne)"
        defaultValue={initialData.instagramUrl}
        error={errorFor('instagramUrl')}
      />
      <div>
        <label
          htmlFor="bankTransferInstructions"
          className="block text-sm font-medium"
        >
          Instrukcje przelewu (używane po potwierdzeniu kwoty)
        </label>
        <textarea
          id="bankTransferInstructions"
          name="bankTransferInstructions"
          rows={3}
          defaultValue={initialData.bankTransferInstructions}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('bankTransferInstructions') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('bankTransferInstructions')}
          </p>
        )}
      </div>
      <Field
        id="deliveryQuoteWording"
        label="Komunikat o wycenie wysyłki (publiczne)"
        defaultValue={initialData.deliveryQuoteWording}
        error={errorFor('deliveryQuoteWording')}
      />
      <div>
        <label htmlFor="publicNotice" className="block text-sm font-medium">
          Komunikat operacyjny (publiczne, opcjonalnie)
        </label>
        <textarea
          id="publicNotice"
          name="publicNotice"
          rows={2}
          defaultValue={initialData.publicNotice}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <Field
        id="bookingCtaLabel"
        label="Etykieta CTA rezerwacji"
        defaultValue={initialData.bookingCtaLabel}
        error={errorFor('bookingCtaLabel')}
      />
      <Field
        id="defaultSeoTitle"
        label="Domyślny tytuł SEO"
        defaultValue={initialData.defaultSeoTitle}
        error={errorFor('defaultSeoTitle')}
      />
      <div>
        <label
          htmlFor="defaultSeoDescription"
          className="block text-sm font-medium"
        >
          Domyślny opis SEO
        </label>
        <textarea
          id="defaultSeoDescription"
          name="defaultSeoDescription"
          rows={3}
          defaultValue={initialData.defaultSeoDescription}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('defaultSeoDescription') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('defaultSeoDescription')}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Zapisywanie…' : 'Zapisz ustawienia'}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type = 'text',
  defaultValue,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
