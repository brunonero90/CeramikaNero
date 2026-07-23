export function PreviewBanner({ entityType }: { entityType: string }) {
  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <p className="font-medium">Podgląd {entityType}</p>
      <p className="text-sm">
        Ta treść nie jest publicznie dostępna. Widzisz ją, ponieważ jesteś
        zalogowany jako administrator.
      </p>
      <meta name="robots" content="noindex, nofollow" />
    </div>
  );
}
