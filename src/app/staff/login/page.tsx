import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginStaff } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { loadTenantMember } from "@/server/auth/tenancy";

const MESSAGES: Record<string, string> = {
  invalid: "That e-mail and password do not match an active staff account.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  forbidden: "This account does not have an active hotel membership.",
};

/**
 * Tenant console sign-in. Deliberately separate from the guest sign-in on the
 * public site: hotel staff and administrators enter here, and only an ACTIVE
 * organization membership is allowed through.
 */
export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const error = MESSAGES[sp.error ?? ""] ?? null;

  const session = await getCurrentSession();
  if (session?.kind === "staff" && session.userId) {
    const member = await loadTenantMember(session.userId, session.orgId);
    if (member) redirect("/admin");
    if (session.platformRole) redirect("/platform");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-zinc-900 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Building2 size={22} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Santo Hotel
            </p>
            <h1 className="text-xl font-semibold">Staff &amp; administrator sign in</h1>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={loginStaff} className="space-y-4">
          <input type="hidden" name="portal" value="tenant" />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Staff email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <Button className="w-full" type="submit">
            Sign in to the console
            <ArrowRight />
          </Button>
        </form>

        <div className="mt-6 space-y-2 border-t pt-4 text-xs text-zinc-500">
          <p>
            Santo platform operator?{" "}
            <Link href="/platform/login" className="font-medium text-zinc-900 underline">
              Sign in to the platform console
            </Link>
            .
          </p>
          <p>
            Guest looking for a booking?{" "}
            <Link href="/login" className="underline">
              Guest sign in
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
