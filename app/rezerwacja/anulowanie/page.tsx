import { cancelBookingWithToken } from './actions';

export default async function CancellationPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; token?: string }>;
}) {
  const { reference, token } = await searchParams;

  if (!reference || !token) {
    return (
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-4">Nieprawidłowy link</h1>
        <p>
          Brakujące dane anulacji. Skontaktuj się z nami, jeśli potrzebujesz
          pomocy.
        </p>
      </main>
    );
  }

  const formData = new FormData();
  formData.set('reference', reference);
  formData.set('token', token);
  const result = await cancelBookingWithToken(formData);

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-4">
        {result.ok ? 'Anulacja' : 'Nie udało się anulować'}
      </h1>
      <p className="text-lg">{result.ok ? result.message : result.error}</p>
    </main>
  );
}
