import type { Metadata } from "next";
import { DM_Sans, Manrope, Noto_Sans_Arabic, Playfair_Display } from "next/font/google";
import { LocaleProvider } from "@/components/hotel/locale-provider";
import { LOCALE_DIRS } from "@/lib/i18n";
import { displayLocale } from "@/server/locale/display";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: "italic",
  variable: "--font-playfair",
});

// Arabic has no coverage in the three Latin faces above; without a dedicated
// face the browser falls back to whatever system Arabic font it happens to
// have, which varies wildly between Windows, macOS and Android.
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
});

export const metadata: Metadata = {
  title: {
    default: "Santo Hotel",
    template: "%s | Santo Hotel",
  },
  description: "A considered stay. A genuine welcome. Discover Santo Hotel.",
};

/**
 * `lang` and `dir` follow the `santo_locale` cookie so assistive tech and
 * the browser's own hyphenation/line-breaking switch with the visitor's
 * language — Arabic flips the whole document to right-to-left.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await displayLocale();

  return (
    <html
      lang={locale}
      dir={LOCALE_DIRS[locale]}
      className={`${dmSans.variable} ${manrope.variable} ${playfair.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <LocaleProvider value={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
