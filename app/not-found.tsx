import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-heading text-7xl font-bold text-accent-primary md:text-8xl">
        404
      </h1>
      <p className="mt-4 font-heading text-2xl font-semibold text-text-primary">
        Strona nie została znaleziona
      </p>
      <p className="mt-2 max-w-md text-text-muted">
        Nie mogliśmy odnaleźć strony, której szukasz. Wróć na stronę główną lub
        skontaktuj się z nami.
      </p>
      <Button href="/" variant="primary" className="mt-8">
        Wróć do strony główna
      </Button>
    </div>
  );
}
