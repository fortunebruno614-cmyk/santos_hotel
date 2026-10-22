import { cookies } from "next/headers";
import {
  CURRENCY_COOKIE,
  DEFAULT_DISPLAY_CURRENCY,
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/currency";

/**
 * The currency the current visitor wants to *see* prices in, read from the
 * `santo_currency` cookie. Defaults to the hotel's own currency (Naira) for a
 * first-time visitor.
 *
 * Reading a cookie makes the calling route dynamic — every public page already
 * is (they resolve the visitor's session).
 */
export async function displayCurrency(): Promise<DisplayCurrency> {
  const raw = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return isDisplayCurrency(raw) ? raw : DEFAULT_DISPLAY_CURRENCY;
}
