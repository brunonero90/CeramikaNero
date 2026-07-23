import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata = {
  title: 'Logowanie | Ceramika Nero Admin',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-semibold">Ceramika Nero</h1>
        <p className="text-center text-sm text-gray-600">
          Panel administracyjny
        </p>
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
