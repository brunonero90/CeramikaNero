import {
  CART_SCHEMA_VERSION,
  CART_STORAGE_KEY,
  type CartLine,
  type CartState,
} from '@/lib/cart/types';

function emptyCart(): CartState {
  return {
    version: CART_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    lines: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeLine(raw: unknown): CartLine | null {
  if (!isObject(raw)) return null;
  const type = raw.type;
  const rawQty = Number(raw.quantity);
  if (!Number.isFinite(rawQty) || rawQty < 1) return null;
  const quantity = Math.min(10, Math.floor(rawQty));

  if (type === 'workshop_session') {
    if (typeof raw.sessionId !== 'string' || !raw.sessionId) return null;
    if (typeof raw.workshopSlug !== 'string') return null;
    return {
      type: 'workshop_session',
      key: typeof raw.key === 'string' ? raw.key : `workshop:${raw.sessionId}`,
      sessionId: raw.sessionId,
      workshopId: typeof raw.workshopId === 'string' ? raw.workshopId : '',
      workshopSlug: raw.workshopSlug,
      workshopTitle:
        typeof raw.workshopTitle === 'string' ? raw.workshopTitle : 'Warsztat',
      startsAt: typeof raw.startsAt === 'string' ? raw.startsAt : '',
      timezone:
        typeof raw.timezone === 'string' ? raw.timezone : 'Europe/Warsaw',
      venueKey: typeof raw.venueKey === 'string' ? raw.venueKey : null,
      locationName:
        typeof raw.locationName === 'string' ? raw.locationName : null,
      locationAddress:
        typeof raw.locationAddress === 'string' ? raw.locationAddress : null,
      quantity,
      unitPriceHintGrosz: Number(raw.unitPriceHintGrosz) || 0,
    };
  }

  if (type === 'physical_product' || type === 'studio_service') {
    if (typeof raw.productId !== 'string' || !raw.productId) return null;
    const fulfillment = raw.fulfillment === 'shipping' ? 'shipping' : 'pickup';
    return {
      type,
      key:
        typeof raw.key === 'string'
          ? raw.key
          : `product:${raw.productId}:${fulfillment}`,
      productId: raw.productId,
      sku: typeof raw.sku === 'string' ? raw.sku : '',
      slug: typeof raw.slug === 'string' ? raw.slug : '',
      title: typeof raw.title === 'string' ? raw.title : 'Produkt',
      quantity,
      fulfillment,
      unitPriceHintGrosz: Number(raw.unitPriceHintGrosz) || 0,
      requiresShipping: Boolean(raw.requiresShipping),
    };
  }

  return null;
}

/** Parse and migrate stored cart. Never trusts prices for checkout. */
export function parseCartState(raw: unknown): CartState {
  if (!isObject(raw)) return emptyCart();
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = linesRaw
    .map(sanitizeLine)
    .filter((line): line is CartLine => line !== null)
    .slice(0, 20);
  return {
    version: CART_SCHEMA_VERSION,
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : new Date().toISOString(),
    lines,
  };
}

export function readCartFromStorage(): CartState {
  if (typeof window === 'undefined') return emptyCart();
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return emptyCart();
    return parseCartState(JSON.parse(raw) as unknown);
  } catch {
    return emptyCart();
  }
}

export function writeCartToStorage(state: CartState): void {
  if (typeof window === 'undefined') return;
  const next: CartState = {
    version: CART_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    lines: state.lines.slice(0, 20),
  };
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
}

export function cartItemCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function mergeLine(lines: CartLine[], line: CartLine): CartLine[] {
  const idx = lines.findIndex((l) => l.key === line.key);
  if (idx === -1) return [...lines, line];
  const existing = lines[idx];
  const quantity = Math.min(10, existing.quantity + line.quantity);
  const next = [...lines];
  next[idx] = { ...existing, ...line, quantity };
  return next;
}
