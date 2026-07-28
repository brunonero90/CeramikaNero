import { describe, expect, it } from 'vitest';
import {
  buildTransferTitle,
  formatBankAccountForDisplay,
  validateBankTransferConfig,
  type BankTransferConfig,
} from '@/lib/payments/bank-transfer';

const valid: BankTransferConfig = {
  enabled: true,
  recipient: 'Ceramika Nero',
  accountNumber: '30114020040000310283149467',
  bankName: 'mBank',
  titleTemplate: '{{order_reference}}',
  deadlineNote: null,
  extraInstructions: null,
};

describe('bank transfer config', () => {
  it('rejects incomplete config', () => {
    const result = validateBankTransferConfig({
      ...valid,
      accountNumber: '',
    });
    expect(result.ok).toBe(false);
  });

  it('accepts valid NRB and groups for display', () => {
    const result = validateBankTransferConfig(valid);
    expect(result.ok).toBe(true);
    expect(formatBankAccountForDisplay(valid.accountNumber)).toBe(
      '30 1140 2004 0000 3102 8314 9467'
    );
  });

  it('builds transfer title from template', () => {
    expect(
      buildTransferTitle('Zamówienie {{order_reference}}', 'CN-O-20260728-ABCD')
    ).toBe('Zamówienie CN-O-20260728-ABCD');
  });
});
