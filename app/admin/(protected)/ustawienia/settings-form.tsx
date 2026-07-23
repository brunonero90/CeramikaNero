'use client';

import { useActionState } from 'react';
import type { SettingsActionState } from './actions';

type SettingsFormData = {
  studioName: string;
  studioAddress: string;
  studioEmail: string;
  studioPhone: string;
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
        label="Nazwa pracowni"
        defaultValue={initialData.studioName}
        error={errorFor('studioName')}
      />
      <Field
        id="studioAddress"
        label="Adres"
        defaultValue={initialData.studioAddress}
        error={errorFor('studioAddress')}
      />
      <Field
        id="studioEmail"
        label="Email"
        type="email"
        defaultValue={initialData.studioEmail}
        error={errorFor('studioEmail')}
      />
      <Field
        id="studioPhone"
        label="Telefon"
        defaultValue={initialData.studioPhone}
        error={errorFor('studioPhone')}
      />
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
