import { cookies } from "next/headers";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import {
  makeTranslator,
  type Dictionary,
  type Translator,
} from "@/lib/dictionaries";

/**
 * The language the current visitor wants to read the site in, from the
 * `santo_locale` cookie. Defaults to English for a first-time visitor.
 *
 * Reading a cookie makes the calling route dynamic — every public page
 * already is (they resolve the visitor's session and display currency).
 */
export async function displayLocale(): Promise<Locale> {
  const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * Server-side translator for the current request. Server Components cannot
 * read React context, so they bind the cookie directly:
 *
 *   const t = await getT();
 *   return <h1>{t("nav.rooms")}</h1>;
 *
 * Client Components use `useT()` from src/components/hotel/locale-provider
 * instead — both return the same signature.
 */
export async function getT(): Promise<Translator> {
  return makeTranslator(await displayLocale());
}

/**
 * `generateMetadata` helper so browser-tab titles follow the visitor's
 * language too — the title is the one piece of "the page" that lives outside
 * React:
 *
 *   export const generateMetadata = () => pageMetadata("meta.rooms");
 *
 * The root layout's `%s | Santo Hotel` template still wraps the title.
 */
export async function pageMetadata(
  titleKey: keyof Dictionary,
  descriptionKey?: keyof Dictionary,
): Promise<Metadata> {
  const t = await getT();
  return {
    title: t(titleKey),
    ...(descriptionKey ? { description: t(descriptionKey) } : {}),
  };
}
