import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X, Globe2, UserRound, ArrowUpRight, Instagram, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooking } from "./booking-context";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
const nav = [
  { to: "/", label: "Home" },
  { to: "/rooms", label: "Rooms & Suites" },
  { to: "/offers", label: "Offers" },
  { to: "/hotel", label: "The Hotel" },
  { to: "/contact", label: "Contact" },
] as const;
export function Brand() {
  return (
    <Link to="/" aria-label="Santo Hotel home" className="brand">
      <span>
        SANTO<span className="brand-dot">.</span>
      </span>
      <small>H O T E L</small>
    </Link>
  );
}
export function HotelShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [policy, setPolicy] = useState("");
  const location = useLocation();
  const { currency, setCurrency } = useBooking();
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="desktop-nav">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className={location.pathname === n.to ? "active" : ""}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <span className="language">
              <Globe2 size={14} /> EN
            </span>
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="currency"
            >
              {["USD", "EUR", "GBP"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Link to="/account" className="account-link">
              <UserRound size={16} />
              <span>My Bookings</span>
            </Link>
            <Button asChild className="header-book">
              <Link to="/availability">
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
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMenu(false)}>
                {n.label}
              </Link>
            ))}
            <Link to="/account" onClick={() => setMenu(false)}>
              My Bookings
            </Link>
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
              <Instagram size={18} />
              <Mail size={18} />
            </span>
          </div>
          <div>
            <h3>Explore Santo</h3>
            <Link to="/rooms">Rooms & Suites</Link>
            <Link to="/offers">Special Offers</Link>
            <Link to="/hotel">Our Hotel</Link>
            <Link to="/hotel">Gallery & Facilities</Link>
          </div>
          <div>
            <h3>Your stay</h3>
            <Link to="/account">My Bookings</Link>
            <Link to="/contact">Booking Assistance</Link>
            <Button variant="link" onClick={() => setPolicy("Cancellation policy")}>
              Cancellation Policy
            </Button>
            <Link to="/hotel">Frequently Asked Questions</Link>
          </div>
          <div>
            <h3>Let’s connect</h3>
            <p>
              <MapPin size={15} /> Hotel address to be confirmed
            </p>
            <Link to="/contact">
              Contact our team <ArrowUpRight size={14} />
            </Link>
            <span className="demo-note">
              A demonstration of Santo hospitality.
              <br />
              All imagery and stay details are illustrative.
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Santo Hotel. All rights reserved.</span>
          <div>
            <Button variant="link" onClick={() => setPolicy("Privacy policy")}>
              Privacy Policy
            </Button>
            <Button variant="link" onClick={() => setPolicy("Terms & conditions")}>
              Terms & Conditions
            </Button>
            <span>English · {currency}</span>
          </div>
        </div>
      </footer>
      <Dialog open={!!policy} onOpenChange={() => setPolicy("")}>
        <DialogContent>
          <DialogTitle>{policy}</DialogTitle>
          <DialogDescription>
            Hotel-approved {policy.toLowerCase()} will be provided here. This demonstration does not
            create a reservation, process a payment, or store personal information.
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
