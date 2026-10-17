import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { signupGuest } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { sanitizeNextPath, resolvePostLoginPath } from "@/config/access-map";
import { GUEST_ACCOUNTS_ENABLED } from "@/config/auth";

const ERROR_MESSAGES: Record<string, string> = {
  exists: "Email already registered",
  invalid: "Invalid details — check your name, email and password requirements.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const error = ERROR_MESSAGES[sp.error ?? ""] ?? null;
  const next = sanitizeNextPath(sp.next);

  const session = await getCurrentSession();
  if (session) redirect(resolvePostLoginPath(session, next));

  if (!GUEST_ACCOUNTS_ENABLED) {
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h2>Guest accounts are currently unavailable.</h2>
          <p>Please contact the hotel to complete a booking.</p>
          <Button asChild>
            <Link href="/contact">Contact the hotel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <Breadcrumb current="Create an account" />
      <div className="account-auth">
        <span className="auth-icon">
          <UserRound />
        </span>
        <PageHeading
          eyebrow="YOUR OWN LITTLE CORNER OF SANTO"
          title="Make yourself at home."
          description="Keep your stays and details together."
        />
        {error && <p className="form-error">{error}</p>}

        <form action={signupGuest}>
          <input type="hidden" name="next" value={next ?? ""} />
          <label>
            First name
            <input name="firstName" required autoComplete="given-name" />
          </label>
          <label>
            Last name
            <input name="lastName" required autoComplete="family-name" />
          </label>
          <label>
            Email address
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password (8+ characters, with a number)
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <Button className="w-full" type="submit">
            Create account
            <ArrowRight />
          </Button>
        </form>

        <p className="tiny-note">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
