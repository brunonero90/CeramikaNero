'use client';

import { useActionState, useState } from 'react';
import { MediaPicker } from '../components/media-picker';
import { uploadMediaAction } from '../media/actions';
import { slugifyTitle } from '@/lib/admin/slugs';
import type { BlogPostActionState } from './actions';
import type { MediaAsset, ContentStatus } from '@/lib/database/types';

type BlogPostFormData = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredMediaId: string | null;
  status: ContentStatus;
  authorName: string;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  legacyWixUrl: string;
};

export function BlogPostForm({
  action,
  initialData,
  mediaAssets,
  baseUrl,
  submitLabel,
}: {
  action: (
    prevState: BlogPostActionState | undefined,
    formData: FormData
  ) => Promise<BlogPostActionState>;
  initialData?: Partial<BlogPostFormData>;
  mediaAssets: MediaAsset[];
  baseUrl: string;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState(action, undefined);
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(
    initialData?.featuredMediaId ?? null
  );

  const defaultData: BlogPostFormData = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featuredMediaId: null,
    status: 'draft',
    authorName: '',
    publishedAt: '',
    seoTitle: '',
    seoDescription: '',
    legacyWixUrl: '',
    ...initialData,
  };

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!slug && e.target.value) {
      setSlug(slugifyTitle(e.target.value));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('featuredMediaId', featuredMediaId ?? '');
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
        <label htmlFor="title" className="block text-sm font-medium">
          Tytuł
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={defaultData.title}
          required
          onBlur={handleTitleBlur}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('title') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('title')}</p>
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
        <label htmlFor="excerpt" className="block text-sm font-medium">
          Wprowadzenie
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          defaultValue={defaultData.excerpt}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('excerpt') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('excerpt')}</p>
        )}
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium">
          Treść (Markdown)
        </label>
        <textarea
          id="content"
          name="content"
          rows={15}
          defaultValue={defaultData.content}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('content') && (
          <p className="mt-1 text-sm text-red-600">{errorFor('content')}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">
          Zdjęcie wyróżniające
        </label>
        <MediaPicker
          assets={mediaAssets}
          baseUrl={baseUrl}
          selectedIds={featuredMediaId ? [featuredMediaId] : []}
          onChange={(ids) => setFeaturedMediaId(ids[0] ?? null)}
          mode="single"
          uploadAction={uploadMediaAction}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
            <option value="published">Opublikowany</option>
            <option value="archived">Zarchiwizowany</option>
          </select>
        </div>
        <div>
          <label htmlFor="publishedAt" className="block text-sm font-medium">
            Data publikacji
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={defaultData.publishedAt}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
          <p className="text-xs text-gray-500">
            Pozostaw puste, aby opublikować natychmiast.
          </p>
        </div>
      </div>
      <div>
        <label htmlFor="authorName" className="block text-sm font-medium">
          Autor
        </label>
        <input
          id="authorName"
          name="authorName"
          type="text"
          defaultValue={defaultData.authorName}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="seoTitle" className="block text-sm font-medium">
          Tytuł SEO
        </label>
        <input
          id="seoTitle"
          name="seoTitle"
          type="text"
          defaultValue={defaultData.seoTitle}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="seoDescription" className="block text-sm font-medium">
          Opis SEO
        </label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          rows={3}
          defaultValue={defaultData.seoDescription}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="legacyWixUrl" className="block text-sm font-medium">
          Legacy Wix URL
        </label>
        <input
          id="legacyWixUrl"
          name="legacyWixUrl"
          type="url"
          defaultValue={defaultData.legacyWixUrl}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {errorFor('legacyWixUrl') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('legacyWixUrl')}
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
