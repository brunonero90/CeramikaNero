'use client';

import { useActionState } from 'react';
import type { Theme } from '@/lib/types/theme';
import type { PageActionState } from './actions';

type PageFormData = {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: 'draft' | 'published' | 'archived';
  suggestedTheme: Theme | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
};

export function PageForm({
  action,
  initialData,
  submitLabel,
}: {
  action: (
    prevState: PageActionState | undefined,
    formData: FormData
  ) => Promise<PageActionState>;
  initialData?: PageFormData;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState<
    PageActionState | undefined,
    FormData
  >(action, undefined);

  const defaultData: PageFormData = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
    suggestedTheme: null,
    seoTitle: '',
    seoDescription: '',
    publishedAt: null,
    ...initialData,
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
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {state && !state.ok && state.errors?.title && (
          <p className="mt-1 text-sm text-red-600">{state.errors.title}</p>
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
        <label htmlFor="excerpt" className="block text-sm font-medium">
          Krótki opis
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={defaultData.excerpt ?? ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium">
          Treść (Markdown)
        </label>
        <textarea
          id="content"
          name="content"
          rows={12}
          defaultValue={defaultData.content ?? ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
        />
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
          <option value="draft">Wersja robocza</option>
          <option value="published">Opublikowana</option>
          <option value="archived">Zarchiwizowana</option>
        </select>
      </div>
      <div>
        <label htmlFor="suggestedTheme" className="block text-sm font-medium">
          Sugerowany motyw
        </label>
        <select
          id="suggestedTheme"
          name="suggestedTheme"
          defaultValue={defaultData.suggestedTheme ?? ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">Domyślny</option>
          <option value="atelier">Atelier</option>
          <option value="joyful">Joyful</option>
        </select>
      </div>
      <div>
        <label htmlFor="seoTitle" className="block text-sm font-medium">
          Tytuł SEO
        </label>
        <input
          id="seoTitle"
          name="seoTitle"
          type="text"
          defaultValue={defaultData.seoTitle ?? ''}
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
          rows={2}
          defaultValue={defaultData.seoDescription ?? ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="publishedAt" className="block text-sm font-medium">
          Data publikacji (opcjonalnie)
        </label>
        <input
          id="publishedAt"
          name="publishedAt"
          type="datetime-local"
          defaultValue={
            defaultData.publishedAt ? defaultData.publishedAt.slice(0, 16) : ''
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
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
