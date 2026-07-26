"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PRODUCTS } from "@/lib/data";

export type CartLine = { productId: string; size: string; qty: number; unitPrice?: number; name?: string };

type CartCtx = {
  lines: CartLine[];
  add: (productId: string, size: string, qty?: number, meta?: { unitPrice?: number; name?: string }) => void;
  setQty: (productId: string, size: string, qty: number) => void;
  remove: (productId: string, size: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const KEY = "bnb_cart_v2";
const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines]);

  const add = (
    productId: string,
    size: string,
    qty = 1,
    meta?: { unitPrice?: number; name?: string }
  ) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId && l.size === size);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId && l.size === size ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { productId, size, qty, unitPrice: meta?.unitPrice, name: meta?.name }];
    });
  };

  const setQty = (productId: string, size: string, qty: number) => {
    if (qty <= 0) {
      setLines((prev) => prev.filter((l) => !(l.productId === productId && l.size === size)));
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.productId === productId && l.size === size ? { ...l, qty } : l))
    );
  };

  const remove = (productId: string, size: string) =>
    setLines((prev) => prev.filter((l) => !(l.productId === productId && l.size === size)));
  const clear = () => setLines([]);

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = PRODUCTS.find((x) => x.id === l.productId);
      const price = l.unitPrice ?? p?.price ?? 0;
      return sum + price * l.qty;
    }, 0);
  }, [lines]);

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, add, setQty, remove, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
