"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CURRENCY_COOKIE, isDisplayCurrency } from "@/lib/currency";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Remembers the guest's display currency (NGN or USD) and re-renders the site.
 * Display only — pricing, quotes and payments keep the hotel's own currency.
 */
export async function setDisplayCurrency(code: string): Promise<void> {
  if (!isDisplayCurrency(code)) return;
  (await cookies()).set(CURRENCY_COOKIE, code, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
