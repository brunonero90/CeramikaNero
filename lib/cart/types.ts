export const CART_STORAGE_KEY = 'ceramika-nero-cart-v1';
export const CART_SCHEMA_VERSION = 1 as const;

export type CartLineWorkshop = {
  type: 'workshop_session';
  key: string;
  sessionId: string;
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  startsAt: string;
  timezone: string;
  venueKey: string | null;
  locationName: string | null;
  locationAddress: string | null;
  quantity: number;
  /** Display-only hint; server recalculates. */
  unitPriceHintGrosz: number;
};

export type CartLineProduct = {
  type: 'physical_product' | 'studio_service';
  key: string;
  productId: string;
  sku: string;
  slug: string;
  title: string;
  quantity: number;
  fulfillment: 'pickup' | 'shipping';
  /** Display-only hint; server recalculates. */
  unitPriceHintGrosz: number;
  requiresShipping: boolean;
};

export type CartLine = CartLineWorkshop | CartLineProduct;

export type CartState = {
  version: typeof CART_SCHEMA_VERSION;
  updatedAt: string;
  lines: CartLine[];
};

export function workshopLineKey(sessionId: string): string {
  return `workshop:${sessionId}`;
}

export function productLineKey(
  productId: string,
  fulfillment: 'pickup' | 'shipping'
): string {
  return `product:${productId}:${fulfillment}`;
}
