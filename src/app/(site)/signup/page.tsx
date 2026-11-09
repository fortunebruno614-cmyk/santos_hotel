import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
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

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const t = await getT();
  const error = ERROR_KEYS[sp.error ?? ""] ? t(ERROR_KEYS[sp.error ?? ""]) : null;
  const next = sanitizeNextPath(sp.next);

  const session = await getCurrentSession();
  if (session) redirect(resolvePostLoginPath(session, next));

  if (!GUEST_ACCOUNTS_ENABLED) {
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h2>{t("signup.disabledTitle")}</h2>
          <p>{t("signup.disabledBody")}</p>
          <Button asChild>
            <Link href="/contact">{t("account.contactHotel")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <Breadcrumb current={t("signup.breadcrumb")} />
      <div className="account-auth">
        <span className="auth-icon">
          <UserRound />
        </span>
        <PageHeading
          eyebrow={t("signup.eyebrow")}
          title={t("signup.title")}
          description={t("signup.description")}
        />
        {error && <p className="form-error">{error}</p>}

        <GoogleSignInButton next={next} mode="signup" />
        <div className="auth-divider" role="separator">
          <span>{t("auth.google.orSignup")}</span>
        </div>

        <form action={signupGuest}>
          <input type="hidden" name="next" value={next ?? ""} />
          <label>
            {t("signup.firstName")}
            <input name="firstName" required autoComplete="given-name" />
          </label>
          <label>
            {t("signup.lastName")}
            <input name="lastName" required autoComplete="family-name" />
          </label>
          <label>
            {t("signup.email")}
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            {t("signup.password")}
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <Button className="w-full" type="submit">
            {t("signup.create")}
            <ArrowRight />
          </Button>
        </form>

        <p className="tiny-note">
          {t("signup.haveAccount")}{" "}
          <Link href="/login" className="underline">
            {t("signup.signIn")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
