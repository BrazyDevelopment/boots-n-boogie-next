"use client";

import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ChunkErrorRecovery } from "@/components/ChunkErrorRecovery";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <ChunkErrorRecovery />
        {children}
      </CartProvider>
    </AuthProvider>
  );
}
