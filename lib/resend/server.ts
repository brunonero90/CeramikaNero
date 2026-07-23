import 'server-only';
import { Resend } from 'resend';

function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return key;
}

export function getResendFromEmail(): string {
  const email = process.env.RESEND_FROM_EMAIL;
  if (!email) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }
  return email;
}

export function getResendReplyToEmail(): string | undefined {
  return process.env.RESEND_REPLY_TO_EMAIL;
}

export function getResendClient(): Resend {
  return new Resend(getResendApiKey());
}
