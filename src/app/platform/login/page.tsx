import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginStaff } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/dal";
import { countPlatformAdmins } from "@/server/platform/admins";

const MESSAGES: Record<string, string> = {
  invalid: "That e-mail and password do not match an active platform operator account.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  forbidden: "This account is not a Santo platform operator.",
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const error = MESSAGES[sp.error ?? ""] ?? null;
  const setupAvailable = (await countPlatformAdmins()) === 0;

  const session = await getCurrentSession();
  if (session?.kind === "staff" && session.platformRole) redirect("/platform");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-zinc-900 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Santo Platform
            </p>
            <h1 className="text-xl font-semibold">Operator sign in</h1>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={loginStaff} className="space-y-4">
          <input type="hidden" name="portal" value="platform" />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Operator email</span>
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
            Sign in to the platform
            <ArrowRight />
          </Button>
        </form>

        <div className="mt-6 space-y-2 border-t pt-4 text-xs text-zinc-500">
          {setupAvailable && (
            <p>
              First time here?{" "}
              <Link href="/platform/setup" className="font-medium text-zinc-900 underline">
                Create the first platform administrator
              </Link>
              .
            </p>
          )}
          <p>
            Hotel staff or administrator?{" "}
            <Link href="/staff/login" className="underline">
              Console sign in
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
