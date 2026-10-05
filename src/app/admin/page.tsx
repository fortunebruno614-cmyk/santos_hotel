import { getCurrentSession } from "@/server/auth/dal";
import { Permissions, hasPermission, AppRole } from "@/server/auth/roles";

export default async function AdminPage() {
  const s = await getCurrentSession();
  const role = s?.role as AppRole;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <li className="border p-4 rounded-md">
          <h2 className="font-medium">Reservations</h2>
          <p className="text-sm text-muted-foreground">Staff can manage reservations</p>
        </li>
        <li className="border p-4 rounded-md">
          <h2 className="font-medium">Rooms</h2>
          <p className="text-sm">Manage rooms & availability</p>
        </li>
        <li className="border p-4 rounded-md">
          <h2 className="font-medium">Rates</h2>
          <p className="text-sm">Manage rates</p>
        </li>
        <li className="border p-4 rounded-md">
          <h2 className="font-medium">Guests</h2>
          <p className="text-sm">View guests</p>
        </li>
        <li className="border p-4 rounded-md">
          <h2 className="font-medium">Payments</h2>
          <p className="text-sm">Payments & refunds</p>
        </li>
        <li className="border p-4 rounded-md">
          <h2 className="font-medium">Reports</h2>
          <p className="text-sm">Reports</p>
        </li>
        {hasPermission(role, Permissions.MANAGE_USERS) && (
          <li className="border p-4 rounded-md">
            <a href="/admin/users" className="font-medium">Users (Admin only)</a>
            <p className="text-sm">Manage staff/admin accounts</p>
          </li>
        )}
      </ul>
    </div>
  );
}
