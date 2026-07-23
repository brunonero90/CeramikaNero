import { ResetPasswordForm } from './reset-password-form';

export const metadata = {
  title: 'Nowe hasło | Ceramika Nero Admin',
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-semibold">Ustaw nowe hasło</h1>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
