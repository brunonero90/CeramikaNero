'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocalCart } from '@/components/clone/local-cart';
import { productLineKey } from '@/lib/cart/types';

type Props = {
  productId: string;
  sku: string;
  slug: string;
  title: string;
  unitPriceGrosz: number;
  productType: 'physical_product' | 'studio_service';
  requiresShipping: boolean;
  allowsPickup: boolean;
};

export function AddToCartButton({
  productId,
  sku,
  slug,
  title,
  unitPriceGrosz,
  productType,
  requiresShipping,
  allowsPickup,
}: Props) {
  const { addLine } = useLocalCart();
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>(
    requiresShipping ? 'shipping' : 'pickup'
  );
  const [added, setAdded] = useState(false);

  function onAdd() {
    addLine({
      type: productType,
      key: productLineKey(productId, fulfillment),
      productId,
      sku,
      slug,
      title,
      quantity,
      fulfillment,
      unitPriceHintGrosz: unitPriceGrosz,
      requiresShipping,
    });
    setAdded(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Ilość
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(e) =>
              setQuantity(
                Math.max(1, Math.min(10, Number(e.target.value) || 1))
              )
            }
            className="mt-1 block w-20 border px-2 py-1"
          />
        </label>
        {requiresShipping || allowsPickup ? (
          <fieldset className="text-sm">
            <legend className="mb-1">Sposób odbioru</legend>
            <div className="flex flex-wrap gap-3">
              {allowsPickup ? (
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name={`fulfillment-${productId}`}
                    checked={fulfillment === 'pickup'}
                    onChange={() => {
                      setFulfillment('pickup');
                      setAdded(false);
                    }}
                  />
                  Odbiór w pracowni
                </label>
              ) : null}
              {requiresShipping ? (
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name={`fulfillment-${productId}`}
                    checked={fulfillment === 'shipping'}
                    onChange={() => {
                      setFulfillment('shipping');
                      setAdded(false);
                    }}
                  />
                  Wysyłka do domu
                </label>
              ) : null}
            </div>
          </fieldset>
        ) : null}
      </div>

      {!added ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full bg-accent-primary px-4 py-3 text-sm font-semibold text-white uppercase"
        >
          Dodaj do koszyka
        </button>
      ) : (
        <div className="space-y-2 rounded border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">
            Dodano do koszyka.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/cart"
              className="bg-accent-primary px-3 py-2 text-sm font-semibold text-white"
            >
              Przejdź do koszyka
            </Link>
            <button
              type="button"
              onClick={() => setAdded(false)}
              className="border px-3 py-2 text-sm"
            >
              Kontynuuj zakupy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
