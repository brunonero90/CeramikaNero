'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type LocalCartItem = {
  id: string;
  title: string;
  priceLabel: string;
  href: string;
};

type CartContextValue = {
  items: LocalCartItem[];
  addItem: (item: LocalCartItem) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Local-only cart. Never calls Stripe or writes production bookings. */
export function LocalCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<LocalCartItem[]>([]);
  const addItem = useCallback((item: LocalCartItem) => {
    setItems((prev) => [...prev, item]);
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(
    () => ({ items, addItem, clear }),
    [items, addItem, clear]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useLocalCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return {
      items: [] as LocalCartItem[],
      addItem: () => undefined,
      clear: () => undefined,
    };
  }
  return ctx;
}
