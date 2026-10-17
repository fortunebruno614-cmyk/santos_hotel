import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { loginStaff, loginGuest } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { sanitizeNextPath, resolvePostLoginPath } from "@/config/access-map";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid credentials",
  rate_limited: "Too many failed attempts — please wait a few minutes and try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const error = ERROR_MESSAGES[sp.error ?? ""] ?? null;
  const expired = sp.expired === "1";
  const next = sanitizeNextPath(sp.next);

  if (!expired) {
    const session = await getCurrentSession();
    if (session) redirect(resolvePostLoginPath(session, next));
  }

  return (
    <div className="container page-content">
      <Breadcrumb current="Sign in" />
      <div className="account-auth">
        <span className="auth-icon">
          <UserRound />
        </span>
        <PageHeading
          eyebrow="YOUR OWN LITTLE CORNER OF SANTO"
          title="Welcome back."
          description="Your stays, your details, all in one place."
        />
        {expired && (
          <p className="form-error">Your session has expired or was revoked. Please sign in again.</p>
        )}
        {error && <p className="form-error">{error}</p>}

        <form action={loginGuest}>
          <input type="hidden" name="next" value={next ?? ""} />
          <label>
            Email address
            <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <Button className="w-full" type="submit">
            Sign in
            <ArrowRight />
          </Button>
        </form>

        <p className="tiny-note">
          New to Santo?{" "}
          <Link href="/signup" className="underline">
            Create a guest account
          </Link>
          .
        </p>

        <details className="faq staff-signin">
          <summary>Staff & administrator sign in</summary>
          <form action={loginStaff}>
            <input type="hidden" name="next" value={next ?? ""} />
            <label>
              Staff email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <Button className="w-full" type="submit">
              Sign in to the console
              <ArrowRight />
            </Button>
          </form>
        </details>
      </div>
    </div>
  );
}
