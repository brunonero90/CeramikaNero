'use client';

import { useActionState, useMemo, useState } from 'react';
import Image from 'next/image';
import type { MediaAsset } from '@/lib/database/types';
import type { MediaUploadActionState } from '@/app/admin/(protected)/media/actions';

type MediaPickerMode = 'single' | 'multiple';

type MediaPickerProps = {
  assets: MediaAsset[];
  baseUrl: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode: MediaPickerMode;
  uploadAction: (
    prevState: MediaUploadActionState | undefined,
    formData: FormData
  ) => Promise<MediaUploadActionState>;
  label?: string;
};

export function MediaPicker({
  assets,
  baseUrl,
  selectedIds,
  onChange,
  mode,
  uploadAction,
  label,
}: MediaPickerProps) {
  const [query, setQuery] = useState('');
  const [uploadState, uploadDispatch, uploadPending] = useActionState(
    uploadAction,
    undefined
  );

  const localAssets = useMemo(() => {
    let combined = assets;
    if (uploadState?.ok && !assets.some((a) => a.id === uploadState.asset.id)) {
      combined = [uploadState.asset, ...assets];
    }
    return combined;
  }, [assets, uploadState]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return localAssets.filter((asset) => {
      if (asset.archivedAt) return false;
      return (
        asset.originalFilename.toLowerCase().includes(q) ||
        asset.altText.toLowerCase().includes(q)
      );
    });
  }, [localAssets, query]);

  const handleSelect = (id: string) => {
    if (mode === 'single') {
      onChange([id]);
    } else {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange(next);
    }
  };

  return (
    <div className="space-y-4">
      {label && <p className="text-sm font-medium">{label}</p>}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj po nazwie lub tekście alternatywnym"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">Brak pasujących zasobów.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((asset) => {
            const selected = selectedIds.includes(asset.id);
            const url = `${baseUrl}/${asset.storagePath}`;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleSelect(asset.id)}
                className={`relative rounded-md border p-2 text-left transition ${
                  selected ? 'ring-2 ring-blue-500' : 'hover:border-gray-400'
                }`}
                aria-pressed={selected}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={url}
                    alt={asset.altText}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                </div>
                <p className="mt-1 truncate text-xs font-medium">
                  {asset.originalFilename}
                </p>
                <p className="text-xs text-gray-500">
                  {asset.width ?? '?'}x{asset.height ?? '?'} ·{' '}
                  {formatBytes(asset.fileSizeBytes ?? 0)}
                </p>
                <p className="truncate text-xs text-gray-600">
                  {asset.altText}
                </p>
                {selected && (
                  <span className="absolute right-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                    Wybrano
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <details className="rounded-md border bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Prześlij nowy plik
        </summary>
        <form action={uploadDispatch} className="mt-3 space-y-3">
          {uploadState?.ok && (
            <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">
              {uploadState.message}
            </p>
          )}
          {!uploadState?.ok && uploadState?.error && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {uploadState.error}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium">Plik</label>
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="mt-1 block w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">
              Tekst alternatywny
            </label>
            <input
              type="text"
              name="altText"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={uploadPending}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {uploadPending ? 'Przesyłanie…' : 'Prześlij'}
          </button>
        </form>
      </details>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
