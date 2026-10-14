import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, UserRound, CalendarDays, ArrowRight, Check, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { StaySummary } from "@/components/hotel/stay-summary";
import { useBooking } from "@/components/hotel/booking-context";
import { roomImage } from "@/components/hotel/shared";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/account")({
  head: () =>
    meta(
      "My Santo",
      "Explore your Santo Hotel demo account, sample bookings and guest profile. No real sign-in or account creation.",
    ),
  component: Account,
});
function Account() {
  const [screen, setScreen] = useState("signin");
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState("upcoming");
  const [saved, setSaved] = useState(false);
  const { selected, booking } = useBooking();
  const signedIn = ["overview", "bookings", "detail", "profile"].includes(screen);
  return (
    <div className="container page-content">
      <Breadcrumb current="My Santo" />
      {!signedIn ? (
        <div className="account-auth">
          <span className="auth-icon">
            <UserRound />
          </span>
          <PageHeading
            eyebrow="YOUR OWN LITTLE CORNER OF SANTO"
            title={
              screen === "register"
                ? "Make yourself at home."
                : screen === "forgot"
                  ? "A fresh start."
                  : screen === "sent"
                    ? "You’re all set."
                    : "Welcome back."
            }
            description={
              screen === "forgot"
                ? "Enter a sample email to preview password recovery."
                : "Your stays, your details, all in one place."
            }
          />
          {screen === "sent" ? (
            <>
              <div className="info-notice">
                <Check />
                <p>Sample recovery request received. No email has been sent.</p>
              </div>
              <Button onClick={() => setScreen("signin")}>Back to sign in</Button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setScreen(screen === "forgot" ? "sent" : "overview");
              }}
            >
              {screen === "register" && (
                <label>
                  Full name
                  <input required autoComplete="off" />
                </label>
              )}
              <label>
                Email address
                <input required type="email" autoComplete="off" placeholder="alex@example.com" />
              </label>
              {screen !== "forgot" && (
                <label>
                  Password
                  <span className="password-input">
                    <input
                      required
                      type={visible ? "text" : "password"}
                      minLength={6}
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={visible ? "Hide password" : "Show password"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff /> : <Eye />}
                    </Button>
                  </span>
                </label>
              )}
              {screen === "signin" && (
                <Button type="button" variant="link" onClick={() => setScreen("forgot")}>
                  Forgot password?
                </Button>
              )}
              <Button className="w-full" type="submit">
                {screen === "register"
                  ? "Create demo account"
                  : screen === "forgot"
                    ? "Preview recovery"
                    : "Sign in to demo account"}
                <ArrowRight />
              </Button>
              <p className="tiny-note">
                Demo only. Use sample details. No authentication, password storage or account
                creation.
              </p>
              <Button
                type="button"
                variant="link"
                onClick={() => setScreen(screen === "register" ? "signin" : "register")}
              >
                {screen === "register"
                  ? "Already have an account? Sign in"
                  : "New to Santo? Create an account"}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <>
          <PageHeading
            eyebrow="MY SANTO · DEMO ACCOUNT"
            title="Welcome back, Alex."
            description="Your next chapter is waiting."
          />
          <div className="account-layout">
            <nav className="account-nav">
              {(
                [
                  ["overview", "Overview"],
                  ["bookings", "My bookings"],
                  ["profile", "Profile details"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  variant={screen === id ? "secondary" : "ghost"}
                  key={id}
                  onClick={() => setScreen(id)}
                >
                  {id === "profile" ? <UserRound /> : <CalendarDays />}
                  {label}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setScreen("signin")}>
                <LogOut />
                Sign out
              </Button>
            </nav>
            <section>
              {screen === "profile" ? (
                <form
                  className="form-section"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSaved(true);
                  }}
                >
                  <h2>Your details</h2>
                  <p className="tiny-note">Sample profile. Changes are not stored.</p>
                  <div className="form-grid">
                    <label>
                      First name
                      <input defaultValue="Alex" />
                    </label>
                    <label>
                      Last name
                      <input defaultValue="Morgan" />
                    </label>
                    <label>
                      Email address
                      <input type="email" defaultValue="alex@example.com" />
                    </label>
                    <label>
                      Phone number
                      <input type="tel" placeholder="Not provided" />
                    </label>
                  </div>
                  <Button>Preview profile update</Button>
                  {saved && (
                    <p role="status" className="policy-note">
                      <Check />
                      Profile preview updated. Nothing has been saved.
                    </p>
                  )}
                </form>
              ) : screen === "detail" ? (
                <>
                  <h2>Your sample booking</h2>
                  <p>{tab === "upcoming" ? "ST-DEMO-2026 · Upcoming" : "ST-PAST-DEMO · Completed"} · No reservation exists</p>
                  {tab === "upcoming" ? <StaySummary /> : <article className="account-booking"><img src={roomImage(selected)} alt={selected.name}/><div><span className="subtle-badge">Completed · Demo</span><h3>{selected.name}</h3><p>12–15 September 2026</p><p>Alex Morgan · Placeholder guest</p><p>Payment: sample data only · No payment taken</p><p>Cancellation terms to be confirmed.</p></div></article>}
                  <Button variant="link" onClick={() => setScreen("bookings")}>
                    Back to my bookings
                  </Button>
                </>
              ) : (
                <>
                  <div className="section-heading">
                    <h2>{screen === "overview" ? "Your next stay" : "My bookings"}</h2>
                    <span className="subtle-badge">Sample records</span>
                  </div>
                  <div className="segmented">
                    <Button
                      variant={tab === "upcoming" ? "default" : "ghost"}
                      onClick={() => setTab("upcoming")}
                    >
                      Upcoming
                    </Button>
                    <Button
                      variant={tab === "past" ? "default" : "ghost"}
                      onClick={() => setTab("past")}
                    >
                      Past stays
                    </Button>
                  </div>
                  <article className="account-booking">
                    <img src={roomImage(selected)} alt={selected.name} />
                    <div>
                      <span className="subtle-badge">
                        {tab === "upcoming" ? "Upcoming · Demo" : "Completed · Demo"}
                      </span>
                      <h3>{selected.name}</h3>
                      <p>
                        {tab === "upcoming"
                          ? `${booking.checkIn} — ${booking.checkOut}`
                          : "12–15 September 2026"}
                      </p>
                      <p>
                        {booking.adults} adults · {booking.quantity} room
                      </p>
                      <small>
                        Reference: {tab === "upcoming" ? "ST-DEMO-2026" : "ST-PAST-DEMO"}
                      </small>
                      <Button
                        variant="link"
                        onClick={() => {
                          setScreen("detail");
                        }}
                      >
                        View sample booking
                        <ArrowRight />
                      </Button>
                    </div>
                  </article>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
