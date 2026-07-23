import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { featureCards } from '@/lib/fixtures/homepage';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-4 py-24 md:py-32 lg:py-40">
        <div className="absolute inset-0 -z-10 opacity-20">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-secondary/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent-primary/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-heading text-4xl font-semibold leading-tight text-text-primary md:text-5xl lg:text-6xl">
            Tu glina zmienia się w coś osobistego
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted md:text-xl">
            Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w naszej
            pracowni w Suchym Lesie.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/warsztaty" variant="primary">
              Zarezerwuj warsztat
            </Button>
            <Button href="/pracownia" variant="outline">
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

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="group rounded-lg bg-surface-bg p-6 shadow-sm transition-base hover:shadow-md"
              >
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
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl rounded-lg bg-surface-raised p-8 text-center shadow-md md:p-12">
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
