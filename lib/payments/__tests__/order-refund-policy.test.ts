import { describe, expect, it } from 'vitest';
import { requiresExternalRefundConfirmation } from '../order-refund-policy';

describe('unified-order refund policy', () => {
  it('executes Stripe refunds in-app', () => {
    expect(requiresExternalRefundConfirmation('stripe')).toBe(false);
  });

  it.each(['bank_transfer', 'cash', 'card_terminal', 'other'])(
    'requires confirmation that a %s refund was completed externally',
    (provider) => {
      expect(requiresExternalRefundConfirmation(provider)).toBe(true);
    }
  );
});
