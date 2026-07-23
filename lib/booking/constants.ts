export const UNPAID_RESERVATION_MINUTES = 15;
export const MAX_PARTICIPANTS_PER_BOOKING = 10;
export const CANCELLATION_HOURS_BEFORE_SESSION = 24;
export const CANCELLATION_TOKEN_HOURS = 48;
export const CURRENCY = 'PLN';
export const BOOKING_CRON_INTERVAL_MINUTES = 5;

export const STRIPE_PROVIDER = 'stripe';
export const MANUAL_PAYMENT_METHODS = {
  cash: 'cash',
  bankTransfer: 'bank_transfer',
  cardTerminal: 'card_terminal',
  complimentary: 'complimentary',
  other: 'other',
} as const;
