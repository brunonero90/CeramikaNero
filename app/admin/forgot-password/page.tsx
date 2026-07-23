import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = {
  title: 'Nie pamiętasz hasła? | Ceramika Nero Admin',
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-semibold">Reset hasła</h1>
        <ForgotPasswordForm />
        <p className="text-center text-sm">
          <Link href="/admin/login" className="text-gray-900 underline">
            Wróć do logowania
          </Link>
        </p>
      </div>
    </div>
  );
}
