import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePlatformPage } from "@/server/auth/tenancy";
import { logout } from "@/server/auth/actions";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { session, platformRole } = await requirePlatformPage();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Santo Platform</p>
            <p className="font-medium">{platformRole} operator</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-xs text-zinc-500">{session.email ?? session.userId}</span>
          <Link href="/platform/organizations/new" className="border px-3 py-1 rounded-md">
            Onboard organization
          </Link>
          <form action={logout}>
            <button className="border px-3 py-1 rounded-md">Sign out</button>
          </form>
        </div>
      </header>
      <nav className="border-b px-6 py-2 flex gap-4 text-sm">
        <Link href="/platform" className="hover:underline">
          Organizations
        </Link>
        <Link href="/platform/organizations/new" className="hover:underline">
          New organization
        </Link>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
