import { describe, expect, it } from 'vitest';
import { requiresExternalRefundConfirmation } from '../order-refund-policy';

describe('unified-order refund policy', () => {
  it.each(['stripe', 'voucher'])(
    'executes %s refunds in-app',
    (provider) => {
      expect(requiresExternalRefundConfirmation(provider)).toBe(false);
    }
  );

  it.each(['bank_transfer', 'cash', 'card_terminal', 'other'])(
    'requires confirmation that a %s refund was completed externally',
    (provider) => {
      expect(requiresExternalRefundConfirmation(provider)).toBe(true);
    }
  );
});
