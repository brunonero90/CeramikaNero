export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-surface-subtle border-t-accent-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Ładowanie...</span>
        <p className="text-sm text-text-muted" aria-hidden="true">
          Ładowanie strony…
        </p>
      </div>
    </div>
  );
}
