import { redirect } from "next/navigation";
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

  // `?expired=1` marks a revoked/invalid token: skip the "already signed in"
  // bounce so the user can actually reach this form instead of looping.
  if (!expired) {
    const s = await getCurrentSession();
    if (s) redirect(resolvePostLoginPath(s, next));
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 border border-black/10 dark:border-white/15 p-6 rounded-xl">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {expired && (
          <p className="text-sm text-amber-600">
            Your session has expired or was revoked. Please sign in again.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form action={loginStaff} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Staff/Admin email</label>
            <input name="email" type="email" required className="w-full border px-3 py-2 rounded-md" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <input name="password" type="password" required className="w-full border px-3 py-2 rounded-md" />
          </div>
          <button type="submit" className="w-full border px-3 py-2 rounded-md">Sign in as staff/admin</button>
        </form>
        <div className="border-t pt-6 space-y-4">
          <h2 className="text-lg font-medium">Guest sign in</h2>
          <form action={loginGuest} className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input name="email" type="email" required className="w-full border px-3 py-2 rounded-md" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input name="password" type="password" required className="w-full border px-3 py-2 rounded-md" />
            </div>
            <button type="submit" className="w-full border px-3 py-2 rounded-md">Sign in as guest</button>
          </form>
          <p className="text-sm text-center">
            No account? <a href="/signup" className="underline">Sign up</a>
          </p>
        </div>
      </div>
    </main>
  );
}
