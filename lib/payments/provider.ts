import 'server-only';
import { isStripeConfigured } from '@/lib/booking/local-mode';

export type PaymentsProviderMode = 'manual' | 'stripe' | 'both';

export type SelectedPaymentMethod = 'stripe' | 'bank_transfer';

/**
 * Server-side payment provider switch.
 * - manual: bank transfer only
 * - stripe: Stripe Checkout when configured (required); never silent fallback
 * - both: customer must explicitly choose; both methods must be usable
 */
export function getPaymentsProviderMode(): PaymentsProviderMode {
  const raw = (process.env.PAYMENTS_PROVIDER ?? 'manual').trim().toLowerCase();
  if (raw === 'stripe' || raw === 'both' || raw === 'manual') {
    return raw;
  }
  throw new Error('Invalid PAYMENTS_PROVIDER configuration');
}

export function isStripePaymentsEnabled(): boolean {
  const mode = getPaymentsProviderMode();
  return (mode === 'stripe' || mode === 'both') && isStripeConfigured();
}

export type ResolvePaymentMethodResult =
  { ok: true; method: SelectedPaymentMethod } | { ok: false; error: string };

/**
 * Resolve the payment method for a checkout attempt.
 * Never silently substitutes bank transfer when Stripe is misconfigured.
 */
export function resolveCheckoutPaymentMethod(input: {
  requested?: string | null;
  shippingQuoteRequired: boolean;
}): ResolvePaymentMethodResult {
  let mode: PaymentsProviderMode;
  try {
    mode = getPaymentsProviderMode();
  } catch {
    return {
      ok: false,
      error: 'Płatności są tymczasowo niedostępne. Skontaktuj się z pracownią.',
    };
  }
  const requested = (input.requested ?? '').trim().toLowerCase();

  if (mode === 'manual') {
    return { ok: true, method: 'bank_transfer' };
  }

  if (mode === 'stripe') {
    if (!isStripeConfigured()) {
      return {
        ok: false,
        error:
          'Płatność online jest tymczasowo niedostępna. Skontaktuj się z pracownią.',
      };
    }
    // Shipping-quote orders persist stripe as the chosen method but do not
    // create Checkout until the final total exists.
    return { ok: true, method: 'stripe' };
  }

  // mode === 'both'
  if (requested !== 'stripe' && requested !== 'bank_transfer') {
    return {
      ok: false,
      error: 'Wybierz metodę płatności: przelew lub płatność online.',
    };
  }

  if (requested === 'stripe') {
    if (!isStripeConfigured()) {
      return {
        ok: false,
        error:
          'Płatność online jest tymczasowo niedostępna. Wybierz przelew bankowy lub skontaktuj się z pracownią.',
      };
    }
    return { ok: true, method: 'stripe' };
  }

  return { ok: true, method: 'bank_transfer' };
}

export function shouldCreateStripeCheckoutNow(input: {
  method: SelectedPaymentMethod;
  shippingQuoteRequired: boolean;
  totalGrossGrosz: number;
}): boolean {
  return (
    input.method === 'stripe' &&
    !input.shippingQuoteRequired &&
    input.totalGrossGrosz > 0 &&
    isStripeConfigured()
  );
}

/** Public checkout UI hints — never expose internal config errors as a method. */
export function getPublicPaymentOptions(): {
  mode: PaymentsProviderMode | 'unavailable';
  stripeAvailable: boolean;
  showMethodSelector: boolean;
} {
  let mode: PaymentsProviderMode;
  try {
    mode = getPaymentsProviderMode();
  } catch {
    return {
      mode: 'unavailable',
      stripeAvailable: false,
      showMethodSelector: false,
    };
  }
  const stripeAvailable = isStripePaymentsEnabled();
  return {
    mode,
    stripeAvailable,
    showMethodSelector: mode === 'both' && stripeAvailable,
  };
}
