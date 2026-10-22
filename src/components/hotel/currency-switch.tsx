"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  CURRENCY_NAMES,
  CURRENCY_SYMBOLS,
  DISPLAY_CURRENCIES,
} from "@/lib/currency";
import { setDisplayCurrency } from "@/server/currency/actions";
import { useDisplayCurrency } from "./currency-provider";

/** ₦ / $ segmented control in the header — switches how prices are rendered. */
export function CurrencySwitch() {
  const active = useDisplayCurrency();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (code: (typeof DISPLAY_CURRENCIES)[number]) => {
    if (code === active || pending) return;
    startTransition(async () => {
      await setDisplayCurrency(code);
      router.refresh();
    });
  };

  return (
    <div className="currency-switch" role="group" aria-label="Display currency">
      {DISPLAY_CURRENCIES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === active}
          aria-label={CURRENCY_NAMES[code]}
          title={CURRENCY_NAMES[code]}
          disabled={pending}
          onClick={() => choose(code)}
        >
          {CURRENCY_SYMBOLS[code]}
        </button>
      ))}
    </div>
  );
}
