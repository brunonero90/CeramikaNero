import Image from 'next/image';
import { services } from '@/lib/database/factory';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { getGalleryImages } from '@/lib/media/wix-catalog';
import { mediaAssets } from '@/lib/database/fixtures/data';
import { getMediaUrl } from '@/lib/media';

export const metadata = {
  title: 'Galeria | Ceramika Nero',
  description: 'Prace i chwile z pracowni Ceramika Nero.',
};

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const items = await services.galleryItems.getVisible();

  const fromDatabase = items
    .map((item) => {
      const asset = mediaAssets.find((m) => m.id === item.mediaAssetId);
      const src = getMediaUrl(asset);
      if (!src || !asset) return null;
      return {
        id: item.id,
        src,
        alt: item.title || asset.altText || 'Galeria Ceramika Nero',
        width: asset.width ?? 1200,
        height: asset.height ?? 800,
        title: item.title,
        description: item.description,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const migrated = getGalleryImages().map((image) => ({
    id: image.id,
    src: image.src,
    alt: image.alt || 'Galeria Ceramika Nero',
    width: image.width,
    height: image.height,
    title: image.alt || null,
    description: null as string | null,
  }));

  // Prefer DB items when present; otherwise show the full migrated collection.
  const displayItems = fromDatabase.length > 0 ? fromDatabase : migrated;

  return (
    <div className="container mx-auto px-4 py-8">
      <ThemeSuggestion theme="joyful" />
      <h1 className="mb-2 font-heading text-3xl font-semibold">Galeria</h1>
      <p className="mb-8 max-w-2xl text-text-muted">
        Prace, warsztaty i codzienne chwile z pracowni Ceramika Nero.
      </p>
      {displayItems.length === 0 ? (
        <p className="text-gray-600">Galeria jest pusta.</p>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayItems.map((item, index) => (
            <li key={item.id}>
              <figure>
                <div className="relative aspect-square w-full overflow-hidden bg-surface-subtle">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    priority={index < 4}
                  />
                </div>
                {(item.title || item.description) && (
                  <figcaption className="mt-2 text-sm">
                    {item.title && (
                      <p className="font-medium text-text-primary">
                        {item.title}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-text-muted">{item.description}</p>
                    )}
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
