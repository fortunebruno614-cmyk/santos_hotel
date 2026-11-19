"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
  InlineSuccess,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

/**
 * User & permission management (P7, admin only): create accounts, change roles,
 * activate/deactivate, reset passwords and delete. The backend refuses
 * self-demotion and the removal of the last administrator — those rules live in
 * the service, not here.
 */

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  lastLoginAt: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "A user with that e-mail already exists.",
  cannot_change_self: "You cannot change your own role or access.",
  cannot_delete_self: "You cannot delete your own account.",
  last_admin: "At least one active administrator must remain.",
  not_found: "User not found.",
  invalid_body: "Please check the form values (password: min 8 characters).",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

const EMPTY = { name: "", email: "", password: "", role: "STAFF" };

export function UsersManager({ users, selfId }: { users: UserRow[]; selfId: string }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const request = async (url: string, init: RequestInit, failure: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageFor(body.error) || failure);
        return false;
      }
      return true;
    } catch {
      setError(ERROR_MESSAGES.internal);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    const ok = await request(
      "/api/admin/users",
      {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
        }),
      },
      "Could not create the user.",
    );
    if (ok) window.location.reload();
  };

  const patch = async (id: string, body: Record<string, unknown>, failure: string) => {
    const ok = await request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }, failure);
    if (ok) window.location.reload();
  };

  const remove = async (user: UserRow) => {
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    const ok = await request(`/api/admin/users/${user.id}`, { method: "DELETE", body: "{}" }, "Could not delete the user.");
    if (ok) window.location.reload();
  };

  return (
    <div className="space-y-5">
      <InlineError>{error}</InlineError>
      <InlineSuccess>{notice}</InlineSuccess>

      <Card>
        <CardHeader
          title="New account"
          description="Create a staff or administrator login. The temporary password can be changed by the user after signing in."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Name" className="w-48">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="E-mail" className="w-60">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Temporary password" className="w-48">
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
          </div>
          <Button
            type="button"
            onClick={createUser}
            disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < 8}
          >
            {busy ? "Saving…" : "Create account"}
          </Button>
        </CardBody>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <th>Name</th>
            <th>E-mail</th>
            <th>Role</th>
            <th>Access</th>
            <th>Last sign-in</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="admin-cell-strong">
                {user.name}
                {user.id === selfId && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                )}
              </td>
              <td className="admin-cell-muted">{user.email}</td>
              <td>
                <select
                  value={user.role}
                  disabled={busy || user.id === selfId}
                  onChange={(e) => patch(user.id, { role: e.target.value }, "Could not change the role.")}
                  className="w-auto"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </td>
              <td>
                <button
                  type="button"
                  disabled={busy || user.id === selfId}
                  onClick={() =>
                    patch(
                      user.id,
                      { isActive: !user.isActive },
                      user.isActive ? "Could not deactivate." : "Could not reactivate.",
                    )
                  }
                  className="disabled:pointer-events-none disabled:opacity-50"
                  title={user.isActive ? "Deactivate this account" : "Reactivate this account"}
                >
                  <StatusBadge
                    status={user.isActive ? "ACTIVE" : "INACTIVE"}
                    label={user.isActive ? "Active" : "Inactive"}
                  />
                </button>
              </td>
              <td className="whitespace-nowrap text-muted-foreground">
                {user.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "—"}
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const password = window.prompt(`New password for ${user.email} (min 8 characters).`);
                      if (password) patch(user.id, { password }, "Could not reset the password.");
                    }}
                  >
                    Reset password
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || user.id === selfId}
                    onClick={() => remove(user)}
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
