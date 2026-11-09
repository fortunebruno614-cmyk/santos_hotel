"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Mail,
  MapPin,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AiChat } from "@/components/hotel/ai-chat";
import { CurrencySwitch } from "@/components/hotel/currency-switch";
import { LanguageSwitch } from "@/components/hotel/language-switch";
import { useDisplayCurrency } from "@/components/hotel/currency-provider";
import { useLocale, useT } from "@/components/hotel/locale-provider";
import { LOCALE_NAMES } from "@/lib/i18n";
import type { Dictionary } from "@/lib/dictionaries";
import { defaultStayDates, searchHref } from "@/lib/hotel";
import { logout } from "@/server/auth/actions";

/** Href is the stable identity; the label is translated at render time. */
const NAV = [
  { href: "/", key: "nav.home" },
  { href: "/hotels", key: "nav.hotels" },
  { href: "/rooms", key: "nav.rooms" },
  { href: "/offers", key: "nav.offers" },
  { href: "/hotel", key: "nav.hotel" },
  { href: "/contact", key: "nav.contact" },
] as const;

export function Brand() {
  return (
    <Link href="/" aria-label="Santo Hotel home" className="brand">
      <span>
        SANTO<span className="brand-dot">.</span>
      </span>
      <small>H O T E L</small>
    </Link>
  );
}

export function HotelShell({
  children,
  signedIn,
  staff,
  currency,
  hotelName,
  address,
  email,
  footerNote,
  chatEnabled,
}: {
  children: React.ReactNode;
  signedIn: boolean;
  staff: boolean;
  currency: string;
  hotelName: string;
  address: string;
  email: string | null;
  footerNote: string | null;
  /** False without a Groq key — the bubble is not rendered at all. */
  chatEnabled: boolean;
}) {
  const [menu, setMenu] = useState(false);
  // A key, not a label: the dialog's copy must re-translate if the visitor
  // switches language while it is open.
  const [policy, setPolicy] = useState<keyof Dictionary | null>(null);
  const pathname = usePathname();
  const display = useDisplayCurrency();
  const locale = useLocale();
  const t = useT();
  const bookHref = searchHref({
    ...defaultStayDates(),
    adults: 2,
    children: 0,
    quantity: 1,
  });

  return (
    <div className="santo-site">
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <div className="header-actions">
            <LanguageSwitch />
            <CurrencySwitch />
            {signedIn ? (
              <Link href={staff ? "/admin" : "/account"} className="account-link">
                <UserRound size={16} />
                <span>{staff ? t("header.staffConsole") : t("header.myBookings")}</span>
              </Link>
            ) : (
              <div className="auth-actions">
                <Link href="/login" className="auth-link">
                  {t("header.logIn")}
                </Link>
                <Button asChild size="sm" className="header-signup">
                  <Link href="/signup">{t("header.signUp")}</Link>
                </Button>
              </div>
            )}
            <Button asChild className="header-book">
              <Link href={bookHref}>
                {t("header.book")} <ArrowUpRight />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-toggle"
              aria-label={menu ? t("a11y.closeMenu") : t("a11y.openMenu")}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenu(false)}>
                {t(item.key)}
              </Link>
            ))}
            <Link href={bookHref} onClick={() => setMenu(false)}>
              {t("header.book")}
            </Link>
            <Link href={staff ? "/admin" : "/account"} onClick={() => setMenu(false)}>
              {staff ? t("header.staffConsole") : t("header.myBookings")}
            </Link>
            {!signedIn && (
              <>
                <Link href="/login" onClick={() => setMenu(false)}>
                  {t("header.logIn")}
                </Link>
                <Link href="/signup" onClick={() => setMenu(false)}>
                  {t("header.signUp")}
                </Link>
              </>
            )}
            <div className="mobile-nav-tools">
              <LanguageSwitch />
              <CurrencySwitch />
            </div>
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Brand />
            <p className="footer-tagline">{t("footer.tagline")}</p>
            <span className="footer-social">
              <Camera size={18} />
              <Mail size={18} />
            </span>
          </div>
          <div>
            <h3>{t("footer.explore")}</h3>
            <Link href="/rooms">{t("footer.rooms")}</Link>
            <Link href="/offers">{t("footer.offers")}</Link>
            <Link href="/hotel">{t("footer.ourHotel")}</Link>
            <Link href="/hotel">{t("footer.gallery")}</Link>
          </div>
          <div>
            <h3>{t("footer.yourStay")}</h3>
            <Link href="/account">{t("footer.myBookings")}</Link>
            <Link href="/contact">{t("footer.assistance")}</Link>
            <Button variant="link" onClick={() => setPolicy("policy.cancellation")}>
              {t("footer.cancellation")}
            </Button>
            <Link href="/hotel">{t("footer.faq")}</Link>
            {staff && <Link href="/admin">{t("header.staffConsole")}</Link>}
            {signedIn && (
              <form action={logout}>
                <Button type="submit" variant="link">
                  {t("footer.signOut")}
                </Button>
              </form>
            )}
          </div>
          <div>
            <h3>{t("footer.connect")}</h3>
            <p>
              <MapPin size={15} /> {address}
            </p>
            <Link href="/contact">
              {t("footer.contactTeam")} <ArrowUpRight size={14} />
            </Link>
            {email && (
              <Link href={`mailto:${email}`}>
                {email} <Mail size={13} />
              </Link>
            )}
            <span className="demo-note">
              {footerNote ?? t("footer.note")}
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>{t("footer.copyright", { hotelName })}</span>
          <div>
            <Button variant="link" onClick={() => setPolicy("policy.privacy")}>
              {t("footer.privacy")}
            </Button>
            <Button variant="link" onClick={() => setPolicy("policy.terms")}>
              {t("footer.terms")}
            </Button>
            <span>
              {LOCALE_NAMES[locale]} ·{" "}
              {display === currency.toUpperCase()
                ? currency
                : t("footer.billedIn", { display, currency })}
            </span>
          </div>
        </div>
      </footer>

      <Dialog open={policy !== null} onOpenChange={() => setPolicy(null)}>
        <DialogContent>
          <DialogTitle>{policy ? t(policy) : ""}</DialogTitle>
          <DialogDescription>
            {t("policy.body", { policy: policy ? t(policy).toLowerCase() : "" })}
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {chatEnabled && <AiChat signedIn={signedIn} />}
    </div>
  );
}
