'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  cartItemCount,
  mergeLine,
  readCartFromStorage,
  writeCartToStorage,
} from '@/lib/cart/storage';
import type { CartLine, CartState } from '@/lib/cart/types';
import { CART_SCHEMA_VERSION } from '@/lib/cart/types';

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  ready: boolean;
  addLine: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  replaceLines: (lines: CartLine[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function empty(): CartState {
  return {
    version: CART_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    lines: [],
  };
}

export function LocalCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount (SSR-safe).
    queueMicrotask(() => {
      setState(readCartFromStorage());
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: CartState) => {
    setState(next);
    writeCartToStorage(next);
  }, []);

  const addLine = useCallback(
    (line: CartLine) => {
      persist({
        version: CART_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        lines: mergeLine(state.lines, line),
      });
    },
    [persist, state.lines]
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      const safe = Math.max(0, Math.min(10, Math.floor(quantity)));
      persist({
        version: CART_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        lines:
          safe === 0
            ? state.lines.filter((l) => l.key !== key)
            : state.lines.map((l) =>
                l.key === key ? { ...l, quantity: safe } : l
              ),
      });
    },
    [persist, state.lines]
  );

  const removeLine = useCallback(
    (key: string) => {
      persist({
        version: CART_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        lines: state.lines.filter((l) => l.key !== key),
      });
    },
    [persist, state.lines]
  );

  const clear = useCallback(() => {
    persist(empty());
  }, [persist]);

  const replaceLines = useCallback(
    (lines: CartLine[]) => {
      persist({
        version: CART_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        lines,
      });
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      lines: state.lines,
      itemCount: cartItemCount(state),
      ready,
      addLine,
      setQuantity,
      removeLine,
      clear,
      replaceLines,
    }),
    [state, ready, addLine, setQuantity, removeLine, clear, replaceLines]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useLocalCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useLocalCart must be used within LocalCartProvider');
  }
  return ctx;
}
