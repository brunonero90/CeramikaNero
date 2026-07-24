'use server';

import { createClient } from '@/lib/supabase/server';

export type ForgotPasswordActionState =
  { ok: false; error: string } | { ok: true; message: string };

export async function forgotPasswordAction(
  _prevState: ForgotPasswordActionState | undefined,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  const email = formData.get('email')?.toString().trim() ?? '';

  if (!email) {
    return { ok: false, error: 'Podaj adres email.' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '';
  if (!siteUrl) {
    return {
      ok: false,
      error:
        'Nie skonfigurowano adresu strony. Skontaktuj się z administratorem.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/admin/reset-password`,
  });

  if (error) {
    return {
      ok: false,
      error: 'Nie udało się wysłać linku resetującego. Spróbuj ponownie.',
    };
  }

  return {
    ok: true,
    message:
      'Jeśli podany email istnieje w systemie, wysłaliśmy na niego link resetujący hasło.',
  };
}
