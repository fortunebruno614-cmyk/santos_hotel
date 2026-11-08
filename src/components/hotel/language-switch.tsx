"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import {
  LOCALES,
  LOCALE_NAMES,
  LOCALE_SHORT,
  type Locale,
} from "@/lib/i18n";
import { setLocale } from "@/server/locale/actions";
import { useLocale, useT } from "./locale-provider";

/**
 * Globe + current language code in the header, opening a menu of every
 * language in its own script (English / Français / العربية) — a guest never
 * has to read English to find their own language.
 *
 * Same flow as the currency switch: a server action writes the cookie, then
 * `router.refresh()` re-renders the already-translated server tree. Nothing
 * about the booking or stored records changes.
 */
export function LanguageSwitch() {
  const active = useLocale();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);

  // Click away or Escape closes the menu; focus returns to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const choose = (locale: Locale) => {
    if (locale === active || pending) return;
    setOpen(false);
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <div className="language-switch" ref={wrap}>
      <button
        type="button"
        className="language-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("a11y.language")}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={14} aria-hidden="true" />
        <span>{LOCALE_SHORT[active]}</span>
        <ChevronDown size={13} aria-hidden="true" className="language-caret" />
      </button>

      {open && (
        <ul className="language-menu" role="menu" aria-label={t("a11y.language")}>
          {LOCALES.map((locale) => (
            <li key={locale} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === active}
                lang={locale}
                dir={locale === "ar" ? "rtl" : "ltr"}
                disabled={pending}
                onClick={() => choose(locale)}
              >
                <span className="language-name">{LOCALE_NAMES[locale]}</span>
                {locale === active && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
