import Image from 'next/image';
import { services } from '@/lib/database/factory';
import { ThemeSuggestion } from '@/components/theme-suggestion';

export const metadata = {
  title: 'Galeria | Ceramika Nero',
  description: 'Prace i chwile z pracowni Ceramika Nero.',
};

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const items = await services.galleryItems.getVisible();

  return (
    <div className="container mx-auto px-4 py-8">
      <ThemeSuggestion theme="joyful" />
      <h1 className="mb-6 text-3xl font-semibold">Galeria</h1>
      {items.length === 0 ? (
        <p className="text-gray-600">Galeria jest pusta.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <figure key={item.id} className="rounded-lg border p-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-100">
                <Image
                  src="/placeholder.svg"
                  alt={item.title ?? 'Galeria'}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                />
              </div>
              <figcaption className="mt-2 text-sm">
                {item.title && <p className="font-medium">{item.title}</p>}
                {item.description && (
                  <p className="text-gray-600">{item.description}</p>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
