"use client";

import { createContext, useContext } from "react";
import { DEFAULT_DISPLAY_CURRENCY, type DisplayCurrency } from "@/lib/currency";

/**
 * The visitor's display currency, provided by the site layout (which reads the
 * `santo_currency` cookie on the server) so client-rendered prices agree with
 * the server-rendered ones.
 */
const CurrencyContext = createContext<DisplayCurrency>(DEFAULT_DISPLAY_CURRENCY);

export function CurrencyProvider({
  value,
  children,
}: {
  value: DisplayCurrency;
  children: React.ReactNode;
}) {
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useDisplayCurrency(): DisplayCurrency {
  return useContext(CurrencyContext);
}
