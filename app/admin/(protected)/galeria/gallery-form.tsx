'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { MediaPicker } from '../components/media-picker';
import { uploadMediaAction } from '../media/actions';
import type { GalleryItemActionState } from './actions';
import type { MediaAsset } from '@/lib/database/types';

type GalleryItemFormData = {
  mediaAssetId: string | null;
  title: string;
  description: string;
  category: string;
  displayOrder: number;
  isVisible: boolean;
};

export function GalleryItemForm({
  action,
  initialData,
  mediaAssets,
  baseUrl,
  submitLabel,
}: {
  action: (
    prevState: GalleryItemActionState | undefined,
    formData: FormData
  ) => Promise<GalleryItemActionState>;
  initialData?: Partial<GalleryItemFormData>;
  mediaAssets: MediaAsset[];
  baseUrl: string;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState(action, undefined);
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(
    initialData?.mediaAssetId ?? null
  );

  const defaultData: GalleryItemFormData = {
    mediaAssetId: null,
    title: '',
    description: '',
    category: '',
    displayOrder: 0,
    isVisible: true,
    ...initialData,
  };

  const selectedMedia = mediaAssets.find((m) => m.id === mediaAssetId);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('mediaAssetId', mediaAssetId ?? '');
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
        <label className="block text-sm font-medium">Plik multimedialny</label>
        <MediaPicker
          assets={mediaAssets}
          baseUrl={baseUrl}
          selectedIds={mediaAssetId ? [mediaAssetId] : []}
          onChange={(ids) => setMediaAssetId(ids[0] ?? null)}
          mode="single"
          uploadAction={uploadMediaAction}
        />
        {selectedMedia && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <div className="relative h-10 w-10 overflow-hidden rounded-md bg-gray-100">
              <Image
                src={`${baseUrl}/${selectedMedia.storagePath}`}
                alt={selectedMedia.altText}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <span>{selectedMedia.originalFilename}</span>
            <span className="text-xs">Alt: {selectedMedia.altText}</span>
          </div>
        )}
        {errorFor('mediaAssetId') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('mediaAssetId')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Tytuł
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={defaultData.title}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Opis
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultData.description}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium">
            Kategoria
          </label>
          <input
            id="category"
            name="category"
            type="text"
            defaultValue={defaultData.category}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="displayOrder" className="block text-sm font-medium">
            Kolejność
          </label>
          <input
            id="displayOrder"
            name="displayOrder"
            type="number"
            defaultValue={defaultData.displayOrder}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
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
          Widoczny publicznie
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
