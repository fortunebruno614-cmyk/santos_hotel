import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Check, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/hotel/shared";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { HotelSignupForm } from "./hotel-signup-form";
import { signupGuest } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { sanitizeNextPath, resolvePostLoginPath } from "@/config/access-map";
import { GUEST_ACCOUNTS_ENABLED } from "@/config/auth";
import { getT } from "@/server/locale/display";
import type { Dictionary } from "@/lib/dictionaries";

/** Signup error codes → dictionary keys, translated at render. */
const ERROR_KEYS: Record<string, keyof Dictionary> = {
  exists: "signup.error.exists",
  invalid: "signup.error.invalid",
};

const BENEFITS = [
  "Reservations, rooms and rates in one place",
  "Payments, guests and housekeeping at the desk",
  "Add more properties as the group grows",
  "CAC and business verification handled here",
];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const t = await getT();
  const error = ERROR_KEYS[sp.error ?? ""] ? t(ERROR_KEYS[sp.error ?? ""]) : null;
  const next = sanitizeNextPath(sp.next);
  const mode = sp.type === "hotel" ? "hotel" : "guest";

  const session = await getCurrentSession();
  if (session) redirect(resolvePostLoginPath(session, next));

  return (
    <div className="container page-content">
      <Breadcrumb current={mode === "hotel" ? "Register a hotel" : t("signup.breadcrumb")} />

      <div className="mx-auto mt-6 grid max-w-6xl overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)] lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="relative hidden flex-col justify-between gap-10 bg-primary px-9 py-10 text-primary-foreground lg:flex">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-primary-foreground/70">
              Santo for hotels
            </p>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight">
              One console for every property you run.
            </h2>
            <p className="mt-4 text-sm leading-6 text-primary-foreground/75">
              Join the Santo marketplace, keep your inventory and rates in sync, and take bookings
              from a single calm workspace.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                    <Check className="size-3" />
                  </span>
                  <span className="text-primary-foreground/90">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
              <ShieldCheck className="size-4" /> Business verification
            </p>
            <p className="text-xs leading-5 text-primary-foreground/70">
              Upload a CAC certificate, business licence or other ownership evidence during
              sign-up. The Santo team reviews it before your listing goes live.
            </p>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-7 inline-flex rounded-full bg-muted p-1">
            <Link
              href="/signup"
              aria-current={mode === "guest" ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                mode === "guest"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserRound className="size-3.5" /> Guest account
            </Link>
            <Link
              href="/signup?type=hotel"
              aria-current={mode === "hotel" ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                mode === "hotel"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="size-3.5" /> Hotel / business
            </Link>
          </div>

          {mode === "hotel" ? (
            <div className="space-y-6">
              <div>
                <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="size-3.5" /> Multi-tenant onboarding
                </p>
                <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                  Register your hotel business
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Create the business account and its first property. You will sign in at the staff
                  console to add rooms, rates and your public listing.
                </p>
              </div>
              <HotelSignupForm />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  {t("signup.eyebrow")}
                </p>
                <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                  <UserRound className="size-5 text-primary" /> {t("signup.title")}
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {t("signup.description")}
                </p>
              </div>

              {!GUEST_ACCOUNTS_ENABLED ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("signup.disabledTitle")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t("signup.disabledBody")}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link href="/contact">{t("account.contactHotel")}</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/signup?type=hotel">
                        <Building2 /> Register a hotel
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {error}
                    </p>
                  )}

                  <GoogleSignInButton next={next} mode="signup" />
                  <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span>{t("auth.google.orSignup")}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form action={signupGuest} className="space-y-4">
                    <input type="hidden" name="next" value={next ?? ""} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("signup.firstName")}
                        </span>
                        <input
                          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                          name="firstName"
                          required
                          autoComplete="given-name"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("signup.lastName")}
                        </span>
                        <input
                          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                          name="lastName"
                          required
                          autoComplete="family-name"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("signup.email")}
                      </span>
                      <input
                        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("signup.password")}
                      </span>
                      <input
                        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                        name="password"
                        type="password"
                        minLength={8}
                        required
                        autoComplete="new-password"
                      />
                    </label>
                    <Button className="w-full" type="submit" size="lg">
                      {t("signup.create")}
                      <ArrowRight />
                    </Button>
                  </form>

                  <p className="text-center text-xs text-muted-foreground">
                    {t("signup.haveAccount")}{" "}
                    <Link href="/login" className="font-medium text-foreground underline">
                      {t("signup.signIn")}
                    </Link>
                    .
                  </p>

                  <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">Run a hotel?</span>{" "}
                    <Link
                      href="/signup?type=hotel"
                      className="font-medium text-primary underline"
                    >
                      Create a business account
                    </Link>{" "}
                    with KYC verification and the multi-property staff console.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
