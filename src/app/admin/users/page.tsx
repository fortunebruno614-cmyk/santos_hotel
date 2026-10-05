import { requireAdmin } from "@/server/auth/dal";
import { UsersTable } from "./users-table";

export default async function AdminUsersPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-sm text-muted-foreground">
        Admin only — staff cannot open this page or the underlying API routes.
        Role changes are written to the audit log.
      </p>
      <UsersTable />
    </div>
  );
}
