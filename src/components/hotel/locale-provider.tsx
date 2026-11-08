"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { makeTranslator, type Translator } from "@/lib/dictionaries";

/**
 * The visitor's display language, provided by the site layout (which reads
 * the `santo_locale` cookie on the server) so the first paint is already
 * translated — no flash of English before hydration.
 *
 * Only the locale code crosses the server → client boundary; the dictionary
 * itself is bundled client-side and bound by `useT`, because a function
 * cannot be passed as a prop to a Client Component.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  value,
  children,
}: {
  value: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** The active locale code (`"en" | "fr" | "ar"`). */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * The translator for the active locale. A stable identity per locale, so
 * components don't re-render on every parent render.
 */
export function useT(): Translator {
  const locale = useContext(LocaleContext);
  return useMemo(() => makeTranslator(locale), [locale]);
}
