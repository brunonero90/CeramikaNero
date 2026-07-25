import 'server-only';

/**
 * Local booking mode isolates calendar/booking mutations from production
 * Supabase. Enabled only when explicitly requested and never in production.
 *
 * Set BOOKING_LOCAL_MODE=1 in development to use the file-backed store under
 * tmp/local-booking/ (sessions, bookings, email outbox).
 */
export function isBookingLocalMode(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.BOOKING_LOCAL_MODE === '1';
}

export function assertBookingLocalModeAllowed(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.BOOKING_LOCAL_MODE === '1'
  ) {
    throw new Error(
      'BOOKING_LOCAL_MODE cannot be enabled when NODE_ENV=production.'
    );
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/** Banner shown on public calendar when local fixtures are active. */
export const LOCAL_BOOKING_BANNER =
  'TRYB LOKALNY — dane testowe w tmp/local-booking (produkcyjna baza nie jest zmieniana)';
