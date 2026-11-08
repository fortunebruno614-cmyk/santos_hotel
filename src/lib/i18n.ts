/**
 * Display language support for the public site.
 *
 * The visitor's choice lives in the `santo_locale` cookie (mirroring the
 * `santo_currency` pattern in src/lib/currency.ts) and is read on the server,
 * so the first paint is already in the right language — no flash of English.
 *
 * `en` is the source language: every other dictionary is a partial override
 * typed against it (src/lib/dictionaries), so a missing translation is a
 * compile error rather than an English string leaking through.
 */

export const LOCALES = ["en", "fr", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "santo_locale";

/** What the visitor picks from the switcher — each language in its own script. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

/** Short label for the header button (and the `lang` attribute). */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  ar: "AR",
};

/** `dir` for `<html>` — Arabic is the only right-to-left locale we ship. */
export const LOCALE_DIRS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  fr: "ltr",
  ar: "rtl",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return LOCALE_DIRS[locale] === "rtl";
}
