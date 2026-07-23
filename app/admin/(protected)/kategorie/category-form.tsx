'use client';

import { useActionState } from 'react';
import type { Theme } from '@/lib/types/theme';
import type { CategoryActionState } from './actions';

type CategoryFormData = {
  name: string;
  slug: string;
  description: string | null;
  suggestedTheme: Theme;
  displayOrder: number;
  isVisible: boolean;
};

export function CategoryForm({
  action,
  initialData,
  submitLabel,
}: {
  action: (
    prevState: CategoryActionState | undefined,
    formData: FormData
  ) => Promise<CategoryActionState>;
  initialData?: CategoryFormData;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState<
    CategoryActionState | undefined,
    FormData
  >(action, undefined);

  const defaultData: CategoryFormData = {
    name: '',
    slug: '',
    description: '',
    suggestedTheme: 'atelier',
    displayOrder: 0,
    isVisible: true,
    ...initialData,
  };

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
        <label htmlFor="name" className="block text-sm font-medium">
          Nazwa
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={defaultData.name}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {state && !state.ok && state.errors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.errors.name}</p>
        )}
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          defaultValue={defaultData.slug}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {state && !state.ok && state.errors?.slug && (
          <p className="mt-1 text-sm text-red-600">{state.errors.slug}</p>
        )}
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Opis
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultData.description ?? ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="suggestedTheme" className="block text-sm font-medium">
          Sugerowany motyw
        </label>
        <select
          id="suggestedTheme"
          name="suggestedTheme"
          defaultValue={defaultData.suggestedTheme}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="atelier">Atelier</option>
          <option value="joyful">Joyful</option>
        </select>
      </div>
      <div>
        <label htmlFor="displayOrder" className="block text-sm font-medium">
          Kolejność wyświetlania
        </label>
        <input
          id="displayOrder"
          name="displayOrder"
          type="number"
          defaultValue={defaultData.displayOrder}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="isVisible"
          name="isVisible"
          type="checkbox"
          defaultChecked={defaultData.isVisible}
          className="h-4 w-4"
        />
        <label htmlFor="isVisible" className="text-sm font-medium">
          Widoczna publicznie
        </label>
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
