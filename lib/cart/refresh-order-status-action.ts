'use server';

import { getOrderStatusByPublicToken } from '@/lib/cart/order-status';
import type { CustomerOrderStatus } from '@/lib/cart/customer-order-status';
import { reconcileOrderCheckoutFromSession } from '@/lib/cart/reconcile-order-checkout';

/**
 * Re-read order status after Stripe return. When session_id is present,
 * verify payment with Stripe API and confirm the order if paid.
 */
export async function refreshOrderStatusByToken(
  token: string,
  checkoutSessionId?: string | null
): Promise<CustomerOrderStatus | null> {
  if (checkoutSessionId) {
    try {
      await reconcileOrderCheckoutFromSession({
        publicLookupToken: token,
        checkoutSessionId,
      });
    } catch (err) {
      console.error('refreshOrderStatus reconcile failed', err);
    }
  }
  return getOrderStatusByPublicToken(token);
}
