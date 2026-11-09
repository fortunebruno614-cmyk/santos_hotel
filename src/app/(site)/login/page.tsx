import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { loginGuest } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { sanitizeNextPath, resolvePostLoginPath } from "@/config/access-map";
import { getT } from "@/server/locale/display";
import type { Dictionary } from "@/lib/dictionaries";

/** Login error codes → dictionary keys, translated at render. */
const ERROR_KEYS: Record<string, keyof Dictionary> = {
  invalid: "login.error.invalid",
  rate_limited: "login.error.rate_limited",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const t = await getT();
  const error = ERROR_KEYS[sp.error ?? ""] ? t(ERROR_KEYS[sp.error ?? ""]) : null;
  const expired = sp.expired === "1";
  const next = sanitizeNextPath(sp.next);

  if (!expired) {
    const session = await getCurrentSession();
    if (session) redirect(resolvePostLoginPath(session, next));
  }

  return (
    <div className="container page-content">
      <Breadcrumb current={t("login.breadcrumb")} />
      <div className="account-auth">
        <span className="auth-icon">
          <UserRound />
        </span>
        <PageHeading
          eyebrow={t("login.eyebrow")}
          title={t("login.title")}
          description={t("login.description")}
        />
        {expired && <p className="form-error">{t("login.expired")}</p>}
        {error && <p className="form-error">{error}</p>}

        <form action={loginGuest}>
          <input type="hidden" name="next" value={next ?? ""} />
          <label>
            {t("login.email")}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("login.emailPlaceholder")}
            />
          </label>
          <label>
            {t("login.password")}
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <Button className="w-full" type="submit">
            {t("login.signIn")}
            <ArrowRight />
          </Button>
        </form>

        <p className="tiny-note">
          {t("login.newToSanto")}{" "}
          <Link href="/signup" className="underline">
            {t("login.createAccount")}
          </Link>
          .
        </p>

        <p className="tiny-note">
          Hotel staff and administrators use the{" "}
          <Link href="/staff/login" className="underline">
            staff console sign-in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
