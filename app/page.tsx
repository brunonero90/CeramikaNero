import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { featureCards } from '@/lib/fixtures/homepage';
import {
  getHomeHeroImage,
  getHomepageFeatureImages,
} from '@/lib/media/wix-catalog';

export default function HomePage() {
  const hero = getHomeHeroImage();
  const featureImages = getHomepageFeatureImages();

  return (
    <div className="flex flex-col">
      <section className="relative min-h-[70vh] overflow-hidden md:min-h-[80vh]">
        {hero && (
          <Image
            src={hero.src}
            alt={hero.alt || 'Pracownia Ceramika Nero'}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/20" />
        <div className="relative mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-end px-4 pb-16 pt-28 text-center md:min-h-[80vh] md:pb-24">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-white/90 uppercase">
            Ceramika Nero
          </p>
          <h1 className="mt-4 font-heading text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
            Tu glina zmienia się w coś osobistego
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl">
            Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w naszej
            pracowni w Suchym Lesie.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/warsztaty" variant="primary">
              Zarezerwuj warsztat
            </Button>
            <Button
              href="/pracownia"
              variant="outline"
              className="border-white/70 bg-transparent text-white hover:bg-white/10"
            >
              Poznaj pracownię
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-surface-raised px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-semibold text-text-primary md:text-3xl">
              Co u nas tworzysz
            </h2>
            <p className="mt-3 text-text-muted">
              Pracownia otwarta na różne wieki, doświadczenie i okazje. Wybierz
              warsztat dopasowany do Ciebie.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card, index) => {
              const image = featureImages[index];
              return (
                <article key={card.title} className="group flex flex-col">
                  {image && (
                    <div className="relative mb-4 aspect-[4/3] overflow-hidden">
                      <Image
                        src={image.src}
                        alt={image.alt || card.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <h3 className="font-heading text-xl font-semibold text-text-primary">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-text-muted">{card.description}</p>
                  <Link
                    href="/warsztaty"
                    className="mt-4 inline-flex items-center text-sm font-medium text-accent-primary transition-base hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  >
                    Zobacz terminy
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-heading text-2xl font-semibold text-text-primary">
            Zapisz się na warsztat
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-text-muted">
            Sprawdź dostępne terminy i zarezerwuj miejsce w pracowni.
            Przygotujemy dla Ciebie wszystko, czego potrzebujesz.
          </p>
          <Button href="/warsztaty" variant="primary" className="mt-6">
            Zarezerwuj warsztat
          </Button>
        </div>
      </section>
    </div>
  );
}
