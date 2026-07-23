export function formatWarsawDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatUtc(iso: string): string {
  return new Date(iso).toISOString();
}

export function hoursBeforeSession(sessionIso: string): number {
  return (new Date(sessionIso).getTime() - Date.now()) / (1000 * 60 * 60);
}
