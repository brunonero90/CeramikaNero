import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/admin/auth';
import { LoginForm } from './login-form';

export const metadata = {
  title: 'Logowanie | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect('/admin');
  }

  const params = await searchParams;
  const denied = params.error === 'unauthorized';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-semibold">Ceramika Nero</h1>
        <p className="text-center text-sm text-gray-600">
          Panel administracyjny
        </p>
        {denied ? (
          <p
            className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            Sesja nie daje dostępu do panelu. Zaloguj się kontem administratora.
          </p>
        ) : null}
        <LoginForm />
        <p className="text-center text-sm">
          <Link
            href="/admin/forgot-password"
            className="text-gray-900 underline"
          >
            Nie pamiętasz hasła?
          </Link>
        </p>
      </div>
    </div>
  );
}
