/**
 * Display currency support for the public site.
 *
 * Money is stored and charged in the hotel's own currency (`hotels.currency`,
 * currently NGN — see `src/config/booking.ts`). Guests may only choose how those
 * amounts are *rendered*: the preference lives in the `santo_currency` cookie
 * and never reaches pricing, quotes or payment intents.
 */

export const DISPLAY_CURRENCIES = ["NGN", "USD"] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = "NGN";

export const CURRENCY_COOKIE = "santo_currency";

/** Display-only rate: how many Naira buy one US dollar. */
export const USD_TO_NGN_RATE = 1500;

export const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  NGN: "₦",
  USD: "$",
};

export const CURRENCY_NAMES: Record<DisplayCurrency, string> = {
  NGN: "Nigerian Naira",
  USD: "US Dollar",
};

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

/** Units of `to` per one unit of `from`; null when this pair has no rate. */
export function conversionRate(from: string, to: string): number | null {
  const base = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  if (base === target) return 1;
  if (base === "NGN" && target === "USD") return 1 / USD_TO_NGN_RATE;
  if (base === "USD" && target === "NGN") return USD_TO_NGN_RATE;
  return null;
}

export function convertMoney(value: number, from: string, to: string): number {
  const rate = conversionRate(from, to);
  return rate === null ? value : value * rate;
}

/** Locale that renders `currency` the way its readers expect. */
export function moneyLocale(currency: string): string {
  const code = currency.trim().toUpperCase();
  if (code === "NGN") return "en-NG";
  if (code === "USD") return "en-US";
  return "en-NG";
}
