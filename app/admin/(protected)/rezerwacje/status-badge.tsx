type Props = {
  status: string;
};

const labels: Record<string, string> = {
  pending: 'Oczekująca',
  awaiting_payment: 'Oczekuje płatności',
  confirmed: 'Potwierdzona',
  cancelled: 'Anulowana',
  expired: 'Wygasła',
  refunded: 'Zwrócona',
  partially_refunded: 'Częściowy zwrot',
};

const colors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  awaiting_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-800',
  refunded: 'bg-red-100 text-red-800',
  partially_refunded: 'bg-orange-100 text-orange-800',
};

export function BookingStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? 'bg-gray-100'}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
