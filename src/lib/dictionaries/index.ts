import { LOCALES, type Locale } from "@/lib/i18n";
import { en, type Dictionary } from "./en";
import { fr } from "./fr";
import { ar } from "./ar";

export type { Dictionary };

/**
 * Every locale is a *partial* English dictionary: missing keys fall back to
 * English at lookup time, so shipping a half-finished translation never
 * renders an empty label.
 */
const dictionaries: Record<Locale, Partial<Dictionary>> = { en, fr, ar };

/** Merged view of a locale — English underneath, overrides on top. */
export function getDictionary(locale: Locale): Dictionary {
  if (locale === "en") return en;
  return { ...en, ...dictionaries[locale] };
}

/** Values interpolated into `{name}` placeholders. */
export type TranslationParams = Record<string, string | number>;

/**
 * The translator both the server (`getT`) and the client (`useT`) hand out.
 * Keys are checked against `Dictionary`, so a typo fails the build.
 */
export type Translator = (key: keyof Dictionary, params?: TranslationParams) => string;

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Builds a translator bound to one locale. */
export function makeTranslator(locale: Locale): Translator {
  const dict = getDictionary(locale);
  return (key, params) => interpolate(dict[key] ?? en[key] ?? String(key), params);
}

/** Locale codes in menu order — used by the switcher and the sitemap-ish bits. */
export const SUPPORTED_LOCALES = LOCALES;
