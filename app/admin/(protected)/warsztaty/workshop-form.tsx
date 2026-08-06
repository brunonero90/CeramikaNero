'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { MediaPicker } from '../components/media-picker';
import { uploadMediaAction } from '../media/actions';
import { slugifyTitle } from '@/lib/admin/slugs';
import type { WorkshopActionState } from './actions';
import type {
  WorkshopCategory,
  Instructor,
  MediaAsset,
  Theme,
  BookingMode,
  ContentStatus,
} from '@/lib/database/types';

type WorkshopFormData = {
  categoryId: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  practicalInformation: string;
  minimumAge: string;
  maximumAge: string;
  participantAudience: 'adult' | 'child' | 'mixed';
  collectParticipantAge: boolean;
  workshopType: string;
  offersFollowupSession: boolean;
  requiresFollowupSession: boolean;
  followupWorkshopType: string;
  followupMinDays: string;
  followupMaxDays: string;
  defaultDurationMinutes: number;
  defaultCapacity: number;
  defaultPriceGrossPln: number;
  suggestedTheme: Theme | null;
  bookingMode: BookingMode;
  externalBookingUrl: string;
  status: ContentStatus;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  featuredMediaId: string | null;
  instructorIds: string[];
  galleryMedia: { mediaAssetId: string; role: 'gallery' | 'detail' }[];
};

export function WorkshopForm({
  action,
  initialData,
  categories,
  instructors,
  mediaAssets,
  baseUrl,
  submitLabel,
}: {
  action: (
    prevState: WorkshopActionState | undefined,
    formData: FormData
  ) => Promise<WorkshopActionState>;
  initialData?: Partial<WorkshopFormData>;
  categories: WorkshopCategory[];
  instructors: Instructor[];
  mediaAssets: MediaAsset[];
  baseUrl: string;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState(action, undefined);
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    initialData?.bookingMode ?? 'scheduled'
  );
  const [followupMode, setFollowupMode] = useState<
    'none' | 'optional' | 'required'
  >(
    initialData?.requiresFollowupSession
      ? 'required'
      : initialData?.offersFollowupSession
        ? 'optional'
        : 'none'
  );
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(
    initialData?.featuredMediaId ?? null
  );
  const [instructorIds, setInstructorIds] = useState<string[]>(
    initialData?.instructorIds ?? []
  );
  const [galleryMedia, setGalleryMedia] = useState<
    { mediaAssetId: string; role: 'gallery' | 'detail' }[]
  >(initialData?.galleryMedia ?? []);

  const defaultData: WorkshopFormData = {
    categoryId: '',
    title: '',
    slug: '',
    shortDescription: '',
    description: '',
    practicalInformation: '',
    minimumAge: '',
    maximumAge: '',
    participantAudience: 'adult',
    collectParticipantAge: false,
    workshopType: '',
    offersFollowupSession: false,
    requiresFollowupSession: false,
    followupWorkshopType: '',
    followupMinDays: '5',
    followupMaxDays: '45',
    defaultDurationMinutes: 120,
    defaultCapacity: 10,
    defaultPriceGrossPln: 0,
    suggestedTheme: null,
    bookingMode: 'scheduled',
    externalBookingUrl: '',
    status: 'draft',
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
    featuredMediaId: null,
    instructorIds: [],
    galleryMedia: [],
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
    formData.set('instructorIds', JSON.stringify(instructorIds));
    formData.set('galleryMedia', JSON.stringify(galleryMedia));
    dispatch(formData);
  };

  const toggleInstructor = (id: string) => {
    setInstructorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addGalleryMedia = (ids: string[]) => {
    setGalleryMedia((prev) => {
      const existing = new Set(prev.map((p) => p.mediaAssetId));
      const added = ids
        .filter((id) => !existing.has(id))
        .map((id) => ({ mediaAssetId: id, role: 'gallery' as const }));
      return [...prev, ...added];
    });
  };

  const removeGalleryMedia = (index: number) => {
    setGalleryMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const updateGalleryRole = (index: number, role: 'gallery' | 'detail') => {
    setGalleryMedia((prev) =>
      prev.map((item, i) => (i === index ? { ...item, role } : item))
    );
  };

  const errorFor = (path: string): string | undefined =>
    state && !state.ok ? state.errors[path] : undefined;

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Podstawowe informacje</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
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
          <div className="sm:col-span-2">
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
            <label htmlFor="categoryId" className="block text-sm font-medium">
              Kategoria
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={defaultData.categoryId}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Wybierz kategorię</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errorFor('categoryId') && (
              <p className="mt-1 text-sm text-red-600">
                {errorFor('categoryId')}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="suggestedTheme"
              className="block text-sm font-medium"
            >
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
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Opis</h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="shortDescription"
              className="block text-sm font-medium"
            >
              Krótki opis
            </label>
            <textarea
              id="shortDescription"
              name="shortDescription"
              rows={3}
              defaultValue={defaultData.shortDescription}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Pełny opis (Markdown)
            </label>
            <textarea
              id="description"
              name="description"
              rows={10}
              defaultValue={defaultData.description}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            {errorFor('description') && (
              <p className="mt-1 text-sm text-red-600">
                {errorFor('description')}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="practicalInformation"
              className="block text-sm font-medium"
            >
              Informacje praktyczne
            </label>
            <textarea
              id="practicalInformation"
              name="practicalInformation"
              rows={4}
              defaultValue={defaultData.practicalInformation}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Szczegóły</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="minimumAge" className="block text-sm font-medium">
              Wiek minimalny
            </label>
            <input
              id="minimumAge"
              name="minimumAge"
              type="number"
              min={0}
              max={120}
              defaultValue={defaultData.minimumAge}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            {errorFor('minimumAge') && (
              <p className="mt-1 text-sm text-red-600">
                {errorFor('minimumAge')}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="maximumAge" className="block text-sm font-medium">
              Wiek maksymalny
            </label>
            <input
              id="maximumAge"
              name="maximumAge"
              type="number"
              min={0}
              max={120}
              defaultValue={defaultData.maximumAge}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            {errorFor('maximumAge') && (
              <p className="mt-1 text-sm text-red-600">
                {errorFor('maximumAge')}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="defaultDurationMinutes"
              className="block text-sm font-medium"
            >
              Czas trwania (min)
            </label>
            <input
              id="defaultDurationMinutes"
              name="defaultDurationMinutes"
              type="number"
              min={1}
              defaultValue={defaultData.defaultDurationMinutes}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="defaultCapacity"
              className="block text-sm font-medium"
            >
              Domyślna liczba miejsc
            </label>
            <input
              id="defaultCapacity"
              name="defaultCapacity"
              type="number"
              min={1}
              defaultValue={defaultData.defaultCapacity}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="defaultPriceGrossPln"
              className="block text-sm font-medium"
            >
              Domyślna cena brutto (PLN)
            </label>
            <input
              id="defaultPriceGrossPln"
              name="defaultPriceGrossPln"
              type="number"
              min={0}
              step={0.01}
              defaultValue={defaultData.defaultPriceGrossPln}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="bookingMode" className="block text-sm font-medium">
              Tryb rezerwacji
            </label>
            <select
              id="bookingMode"
              name="bookingMode"
              value={bookingMode}
              onChange={(e) => setBookingMode(e.target.value as BookingMode)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="scheduled">Terminy</option>
              <option value="enquiry">Zapytanie</option>
              <option value="external">Zewnętrzny link</option>
            </select>
          </div>
          {bookingMode === 'external' && (
            <div className="sm:col-span-2">
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
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Uczestnicy i etapy</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="participantAudience"
              className="block text-sm font-medium"
            >
              Grupa uczestników
            </label>
            <select
              id="participantAudience"
              name="participantAudience"
              defaultValue={defaultData.participantAudience}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="adult">Dorośli</option>
              <option value="child">Dzieci / młodzież</option>
              <option value="mixed">Grupa mieszana</option>
            </select>
          </div>
          <div>
            <label htmlFor="workshopType" className="block text-sm font-medium">
              Typ operacyjny warsztatu
            </label>
            <input
              id="workshopType"
              name="workshopType"
              defaultValue={defaultData.workshopType || slug}
              placeholder={slug || 'np. glina-do-wina'}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="collectParticipantAge"
              type="checkbox"
              defaultChecked={defaultData.collectParticipantAge}
            />
            Zbieraj wiek dzieci
          </label>
          <div>
            <label htmlFor="followupMode" className="block text-sm font-medium">
              Drugi etap
            </label>
            <select
              id="followupMode"
              name="followupMode"
              value={followupMode}
              onChange={(event) =>
                setFollowupMode(
                  event.target.value as 'none' | 'optional' | 'required'
                )
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="none">Brak</option>
              <option value="optional">Opcjonalny — klient może wybrać</option>
              <option value="required">Obowiązkowy</option>
            </select>
          </div>
          {followupMode !== 'none' ? (
            <>
              <div className="sm:col-span-2">
                <label
                  htmlFor="followupWorkshopType"
                  className="block text-sm font-medium"
                >
                  Typ lub slug warsztatu drugiego etapu
                </label>
                <input
                  id="followupWorkshopType"
                  name="followupWorkshopType"
                  defaultValue={defaultData.followupWorkshopType}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor="followupMinDays"
                  className="block text-sm font-medium"
                >
                  Najwcześniej po (dni)
                </label>
                <input
                  id="followupMinDays"
                  name="followupMinDays"
                  type="number"
                  min={0}
                  defaultValue={defaultData.followupMinDays}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor="followupMaxDays"
                  className="block text-sm font-medium"
                >
                  Najpóźniej po (dni)
                </label>
                <input
                  id="followupMaxDays"
                  name="followupMaxDays"
                  type="number"
                  min={0}
                  defaultValue={defaultData.followupMaxDays}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Status i SEO</h2>
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
          <div className="flex items-center gap-2">
            <input
              id="isFeatured"
              name="isFeatured"
              type="checkbox"
              defaultChecked={defaultData.isFeatured}
              className="h-4 w-4"
            />
            <label htmlFor="isFeatured" className="text-sm font-medium">
              Wyróżniony na stronie głównej
            </label>
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
            <label
              htmlFor="seoDescription"
              className="block text-sm font-medium"
            >
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
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Grafika wyróżniająca</h2>
        <MediaPicker
          assets={mediaAssets}
          baseUrl={baseUrl}
          selectedIds={featuredMediaId ? [featuredMediaId] : []}
          onChange={(ids) => setFeaturedMediaId(ids[0] ?? null)}
          mode="single"
          uploadAction={uploadMediaAction}
          label="Wybierz zdjęcie wyróżniające"
        />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Instruktorzy</h2>
        <div className="space-y-2">
          {instructors.map((instructor) => (
            <label key={instructor.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={instructorIds.includes(instructor.id)}
                onChange={() => toggleInstructor(instructor.id)}
                className="h-4 w-4"
              />
              <span className="text-sm">{instructor.displayName}</span>
            </label>
          ))}
        </div>
        {errorFor('instructorIds') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('instructorIds')}
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Galeria warsztatu</h2>
        <div className="mb-4 space-y-2">
          {galleryMedia.map((item, index) => {
            const asset = mediaAssets.find((a) => a.id === item.mediaAssetId);
            return (
              <div
                key={item.mediaAssetId}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100">
                  {asset && (
                    <Image
                      src={`${baseUrl}/${asset.storagePath}`}
                      alt={asset.altText}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )}
                </div>
                <span className="flex-1 truncate text-sm">
                  {asset?.originalFilename ?? item.mediaAssetId}
                </span>
                <select
                  value={item.role}
                  onChange={(e) =>
                    updateGalleryRole(
                      index,
                      e.target.value as 'gallery' | 'detail'
                    )
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="gallery">Galeria</option>
                  <option value="detail">Szczegół</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeGalleryMedia(index)}
                  className="text-sm text-red-600"
                >
                  Usuń
                </button>
              </div>
            );
          })}
        </div>
        <MediaPicker
          assets={mediaAssets}
          baseUrl={baseUrl}
          selectedIds={galleryMedia.map((g) => g.mediaAssetId)}
          onChange={(ids) => addGalleryMedia(ids)}
          mode="multiple"
          uploadAction={uploadMediaAction}
          label="Dodaj zdjęcia do galerii"
        />
        {errorFor('galleryMedia') && (
          <p className="mt-1 text-sm text-red-600">
            {errorFor('galleryMedia')}
          </p>
        )}
      </section>

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
