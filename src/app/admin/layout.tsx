import { requireStaffOrAdmin } from "@/server/auth/dal";
import { logout } from "@/server/auth/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaffOrAdmin();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-medium">Santo Hotel Admin</span>
        <form action={logout}>
          <button className="border px-3 py-1 rounded-md">Sign out</button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
