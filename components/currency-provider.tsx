"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { CurrencyCode } from "@/lib/currency";
import { formatCurrency, formatCurrencyShort } from "@/lib/currency";

type CurrencyCtx = {
  currency: CurrencyCode;
  format: (amount: number) => string;
  formatShort: (amount: number) => string;
};

// Always "USD" as the server-side default so server and client
// render identical HTML on first paint.
const DEFAULT: CurrencyCode = "USD";

const CurrencyContext = createContext<CurrencyCtx>({
  currency: DEFAULT,
  format: (n) => formatCurrency(n, DEFAULT),
  formatShort: (n) => formatCurrencyShort(n, DEFAULT),
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function CurrencyProvider({
  initialCurrency,
  children,
}: {
  initialCurrency: string;
  children: React.ReactNode;
}) {
  // Both server and client start with the same DEFAULT so the
  // hydration snapshot always matches.
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  // After hydration is complete, switch to the real currency.
  // This runs only in the browser, after React has reconciled the tree.
  useEffect(() => {
    setCurrency((initialCurrency as CurrencyCode) || DEFAULT);
    setHydrated(true);
  }, [initialCurrency]);

  // Use DEFAULT until hydrated so all format() calls during SSR and
  // the initial client render produce identical strings.
  const active = hydrated ? currency : DEFAULT;

  return (
    <CurrencyContext.Provider
      value={{
        currency: active,
        format: (n) => formatCurrency(n, active),
        formatShort: (n) => formatCurrencyShort(n, active),
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
