'use client';

import { useActionState, useState } from 'react';
import { MediaPicker } from '../components/media-picker';
import { uploadMediaAction } from '../media/actions';
import { slugifyTitle } from '@/lib/admin/slugs';
import type { InstructorActionState } from './actions';
import type { MediaAsset } from '@/lib/database/types';

type InstructorFormData = {
  displayName: string;
  slug: string;
  biography: string;
  profileMediaId: string | null;
  isActive: boolean;
  displayOrder: number;
};

export function InstructorForm({
  action,
  initialData,
  mediaAssets,
  baseUrl,
  submitLabel,
}: {
  action: (
    prevState: InstructorActionState | undefined,
    formData: FormData
  ) => Promise<InstructorActionState>;
  initialData?: Partial<InstructorFormData>;
  mediaAssets: MediaAsset[];
  baseUrl: string;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState(action, undefined);
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [profileMediaId, setProfileMediaId] = useState<string | null>(
    initialData?.profileMediaId ?? null
  );

  const defaultData: InstructorFormData = {
    displayName: '',
    slug: '',
    biography: '',
    profileMediaId: null,
    isActive: true,
    displayOrder: 0,
    ...initialData,
  };

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!slug && e.target.value) {
      setSlug(slugifyTitle(e.target.value));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('profileMediaId', profileMediaId ?? '');
    dispatch(formData);
  };

  const errorFor = (path: string): string | undefined =>
    state && !state.ok ? state.errors[path] : undefined;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
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
        <label htmlFor="displayName" className="block text-sm font-medium">
          Wyświetlana nazwa
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={defaultData.displayName}
          required
          onBlur={handleNameBlur}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('displayName') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('displayName')}</p>
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
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('slug') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('slug')}</p>
        )}
      </div>
      <div>
        <label htmlFor="biography" className="block text-sm font-medium">
          Biografia (Markdown)
        </label>
        <textarea
          id="biography"
          name="biography"
          rows={8}
          defaultValue={defaultData.biography}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
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
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked={defaultData.isActive}
          className="h-4 w-4"
        />
        <label htmlFor="isActive" className="text-sm font-medium">
          Aktywny
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium">Zdjęcie profilowe</label>
        <MediaPicker
          assets={mediaAssets}
          baseUrl={baseUrl}
          selectedIds={profileMediaId ? [profileMediaId] : []}
          onChange={(ids) => setProfileMediaId(ids[0] ?? null)}
          mode="single"
          uploadAction={uploadMediaAction}
        />
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
