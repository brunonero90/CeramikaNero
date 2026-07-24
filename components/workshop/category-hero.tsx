import Image from 'next/image';
import { getCategoryImage } from '@/lib/media/wix-catalog';

export function CategoryHero({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string;
}) {
  const image = getCategoryImage(slug);

  return (
    <div className="mx-auto max-w-2xl text-center">
      {image && (
        <div className="relative mx-auto mb-8 aspect-[21/9] w-full max-w-4xl overflow-hidden">
          <Image
            src={image.src}
            alt={image.alt || title}
            fill
            priority
            sizes="(min-width: 896px) 896px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-text-muted">{description}</p>
    </div>
  );
}
