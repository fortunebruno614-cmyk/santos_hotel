import { redirect } from "next/navigation";
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

  const s = await getCurrentSession();
  if (s) redirect(resolvePostLoginPath(s, next));

  if (!GUEST_ACCOUNTS_ENABLED) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Guest accounts are disabled — contact the hotel to complete a booking.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 border border-black/10 dark:border-white/15 p-6 rounded-xl">
        <h1 className="text-2xl font-semibold">Create guest account</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form action={signupGuest} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="space-y-2">
            <label className="text-sm font-medium">First name</label>
            <input name="firstName" required className="w-full border px-3 py-2 rounded-md" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Last name</label>
            <input name="lastName" required className="w-full border px-3 py-2 rounded-md" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input name="email" type="email" required className="w-full border px-3 py-2 rounded-md" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password (8+ characters, with a number)</label>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              className="w-full border px-3 py-2 rounded-md"
            />
          </div>
          <button type="submit" className="w-full border px-3 py-2 rounded-md">Sign up</button>
        </form>
        <p className="text-sm text-center">
          Already have an account? <a href="/login" className="underline">Sign in</a>
        </p>
      </div>
    </main>
  );
}
