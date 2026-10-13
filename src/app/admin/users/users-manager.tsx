"use client";

import { useState } from "react";

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
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <div className="border rounded-md p-4 space-y-3 text-sm">
        <p className="font-medium">New account</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              className="border px-2 py-1 rounded-md w-44"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">E-mail</span>
            <input
              className="border px-2 py-1 rounded-md w-56"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Temporary password</span>
            <input
              type="password"
              className="border px-2 py-1 rounded-md w-44"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Role</span>
            <select
              className="border px-2 py-1 rounded-md"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={createUser}
          disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < 8}
          className="border px-3 py-1 rounded-md disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create account"}
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">E-mail</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3">Access</th>
            <th className="py-2 pr-3">Last sign-in</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b last:border-0">
              <td className="py-2 pr-3 font-medium">
                {user.name}
                {user.id === selfId && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
              </td>
              <td className="py-2 pr-3">{user.email}</td>
              <td className="py-2 pr-3">
                <select
                  value={user.role}
                  disabled={busy || user.id === selfId}
                  onChange={(e) => patch(user.id, { role: e.target.value }, "Could not change the role.")}
                  className="border px-2 py-1"
                >
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td className="py-2 pr-3">
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
                  className={`border px-2 py-1 rounded-md text-xs ${user.isActive ? "" : "text-red-600"}`}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-2 pr-3">{user.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "—"}</td>
              <td className="py-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const password = window.prompt(`New password for ${user.email} (min 8 characters).`);
                      if (password) patch(user.id, { password }, "Could not reset the password.");
                    }}
                    className="border px-2 py-1 rounded-md text-xs"
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    disabled={busy || user.id === selfId}
                    onClick={() => remove(user)}
                    className="border px-2 py-1 rounded-md text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
