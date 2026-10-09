import Link from "next/link";
import { getCurrentSession } from "@/server/auth/dal";
import { logout } from "@/server/auth/actions";

/** Minimal chrome for the public booking site (the root layout stays bare). */
export async function SiteHeader() {
  const session = await getCurrentSession();
  const signedIn = Boolean(session);

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Santo Hotel
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/rooms" className="hover:underline">
            Rooms
          </Link>
          <Link href="/search" className="hover:underline">
            Search
          </Link>
          {signedIn && session?.kind === "guest" ? (
            <>
              <Link href="/account" className="hover:underline">
                My account
              </Link>
              <form action={logout}>
                <button type="submit" className="border px-3 py-1 rounded-md">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
