export function requiresExternalRefundConfirmation(provider: string): boolean {
  return provider !== 'stripe' && provider !== 'voucher';
}
