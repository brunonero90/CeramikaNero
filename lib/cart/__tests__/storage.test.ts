import { describe, expect, it } from 'vitest';
import { mergeLine, parseCartState, cartItemCount } from '@/lib/cart/storage';
import {
  productLineKey,
  workshopLineKey,
  type CartLine,
} from '@/lib/cart/types';

describe('cart storage', () => {
  it('migrates and sanitizes unknown payload', () => {
    const state = parseCartState({
      version: 0,
      lines: [
        {
          type: 'workshop_session',
          sessionId: 's1',
          workshopSlug: 'glina-do-wina',
          quantity: 2,
          unitPriceHintGrosz: 18900,
        },
        { type: 'junk' },
        {
          type: 'physical_product',
          productId: 'p1',
          quantity: 99,
          fulfillment: 'shipping',
          unitPriceHintGrosz: 22900,
          requiresShipping: true,
        },
      ],
    });
    expect(state.lines).toHaveLength(2);
    expect(state.lines[0].quantity).toBe(2);
    expect(state.lines[1].quantity).toBe(10);
    expect(cartItemCount(state)).toBe(12);
  });

  it('merges same session and product+fulfillment keys', () => {
    const a: CartLine = {
      type: 'workshop_session',
      key: workshopLineKey('s1'),
      sessionId: 's1',
      workshopId: 'w1',
      workshopSlug: 'x',
      workshopTitle: 'X',
      startsAt: '',
      timezone: 'Europe/Warsaw',
      venueKey: 'suchy-las',
      locationName: null,
      locationAddress: null,
      quantity: 1,
      unitPriceHintGrosz: 100,
    };
    const b: CartLine = { ...a, quantity: 2 };
    expect(mergeLine([a], b)[0].quantity).toBe(3);

    const p1: CartLine = {
      type: 'physical_product',
      key: productLineKey('p1', 'shipping'),
      productId: 'p1',
      sku: 'GLINA-BOX',
      slug: 'glina-box',
      title: 'Glina Box',
      quantity: 1,
      fulfillment: 'shipping',
      unitPriceHintGrosz: 22900,
      requiresShipping: true,
    };
    const p2: CartLine = { ...p1, quantity: 1 };
    expect(mergeLine([p1], p2)).toHaveLength(1);
    expect(
      mergeLine([p1], {
        ...p2,
        fulfillment: 'pickup',
        key: productLineKey('p1', 'pickup'),
      })
    ).toHaveLength(2);
  });

  it('does not keep purchaser PII fields in sanitized lines', () => {
    const state = parseCartState({
      lines: [
        {
          type: 'workshop_session',
          sessionId: 's1',
          workshopSlug: 'x',
          quantity: 1,
          purchaserEmail: 'secret@example.com',
          deliveryAddress: 'ul. Tajna 1',
        },
      ],
    });
    expect(JSON.stringify(state.lines)).not.toMatch(/secret@example|Tajna/);
  });
});
