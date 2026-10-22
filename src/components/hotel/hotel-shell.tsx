"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Globe2,
  Mail,
  MapPin,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CurrencySwitch } from "@/components/hotel/currency-switch";
import { useDisplayCurrency } from "@/components/hotel/currency-provider";
import { defaultStayDates, searchHref } from "@/lib/hotel";
import { logout } from "@/server/auth/actions";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms & Suites" },
  { href: "/offers", label: "Offers" },
  { href: "/hotel", label: "The Hotel" },
  { href: "/contact", label: "Contact" },
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
}: {
  children: React.ReactNode;
  signedIn: boolean;
  staff: boolean;
  currency: string;
  hotelName: string;
  address: string;
  email: string | null;
  footerNote: string | null;
}) {
  const [menu, setMenu] = useState(false);
  const [policy, setPolicy] = useState("");
  const pathname = usePathname();
  const display = useDisplayCurrency();
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
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-actions">
            <span className="language">
              <Globe2 size={14} /> EN
            </span>
            <CurrencySwitch />
            {signedIn ? (
              <Link href={staff ? "/admin" : "/account"} className="account-link">
                <UserRound size={16} />
                <span>{staff ? "Staff console" : "My Bookings"}</span>
              </Link>
            ) : (
              <div className="auth-actions">
                <Link href="/login" className="auth-link">
                  Log in
                </Link>
                <Button asChild size="sm" className="header-signup">
                  <Link href="/signup">Sign up</Link>
                </Button>
              </div>
            )}
            <Button asChild className="header-book">
              <Link href={bookHref}>
                Book your stay <ArrowUpRight />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-toggle"
              aria-label={menu ? "Close menu" : "Open menu"}
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
                {item.label}
              </Link>
            ))}
            <Link href={bookHref} onClick={() => setMenu(false)}>
              Book your stay
            </Link>
            <Link href={staff ? "/admin" : "/account"} onClick={() => setMenu(false)}>
              {staff ? "Staff console" : "My Bookings"}
            </Link>
            {!signedIn && (
              <>
                <Link href="/login" onClick={() => setMenu(false)}>
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setMenu(false)}>
                  Sign up
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Brand />
            <p>
              A considered stay.
              <br />A genuine welcome.
            </p>
            <span className="footer-social">
              <Camera size={18} />
              <Mail size={18} />
            </span>
          </div>
          <div>
            <h3>Explore Santo</h3>
            <Link href="/rooms">Rooms & Suites</Link>
            <Link href="/offers">Special Offers</Link>
            <Link href="/hotel">Our Hotel</Link>
            <Link href="/hotel">Gallery & Facilities</Link>
          </div>
          <div>
            <h3>Your stay</h3>
            <Link href="/account">My Bookings</Link>
            <Link href="/contact">Booking Assistance</Link>
            <Button variant="link" onClick={() => setPolicy("Cancellation policy")}>
              Cancellation Policy
            </Button>
            <Link href="/hotel">Frequently Asked Questions</Link>
            {staff && <Link href="/admin">Staff console</Link>}
            {signedIn && (
              <form action={logout}>
                <Button type="submit" variant="link">
                  Sign out
                </Button>
              </form>
            )}
          </div>
          <div>
            <h3>Let&apos;s connect</h3>
            <p>
              <MapPin size={15} /> {address}
            </p>
            <Link href="/contact">
              Contact our team <ArrowUpRight size={14} />
            </Link>
            {email && (
              <Link href={`mailto:${email}`}>
                {email} <Mail size={13} />
              </Link>
            )}
            <span className="demo-note">
              {footerNote ?? "Thoughtful stays, considered details. Every reservation is handled by our team."}
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 {hotelName}. All rights reserved.</span>
          <div>
            <Button variant="link" onClick={() => setPolicy("Privacy policy")}>
              Privacy Policy
            </Button>
            <Button variant="link" onClick={() => setPolicy("Terms & conditions")}>
              Terms & Conditions
            </Button>
            <span>
              English ·{" "}
              {display === currency.toUpperCase()
                ? currency
                : `${display} prices · billed in ${currency}`}
            </span>
          </div>
        </div>
      </footer>

      <Dialog open={!!policy} onOpenChange={() => setPolicy("")}>
        <DialogContent>
          <DialogTitle>{policy}</DialogTitle>
          <DialogDescription>
            Our hotel-approved {policy.toLowerCase()} is available from the front desk. Please
            contact the hotel if you need a copy before booking.
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
