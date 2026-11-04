import { listUsers } from "@/server/console/users";
import { getConsoleContext } from "@/server/console/context";
import { UsersManager } from "./users-manager";

/** Users & permissions (P7, admin only). */
export default async function AdminUsersPage() {
  const { session, member } = await getConsoleContext();
  const users = await listUsers(member.organizationId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-zinc-500">
          Staff and administrator accounts. Role changes take effect immediately — the
          previous session stops working on the next request.
        </p>
      </div>
      <UsersManager
        selfId={session.userId ?? ""}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role === "ADMIN" ? "ADMIN" : "STAFF",
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
