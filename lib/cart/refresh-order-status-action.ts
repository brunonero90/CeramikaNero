'use server';

import { getOrderStatusByPublicToken } from '@/lib/cart/order-status';
import type { CustomerOrderStatus } from '@/lib/cart/customer-order-status';

export async function refreshOrderStatusByToken(
  token: string
): Promise<CustomerOrderStatus | null> {
  return getOrderStatusByPublicToken(token);
}
