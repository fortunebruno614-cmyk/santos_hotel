"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
};

export function UsersTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        setRows((await res.json()) as Row[]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function changeRole(id: string, role: Row["role"]) {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`update failed (${res.status})`);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "update failed");
    } finally {
      setSaving(null);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (rows.length === 0) return <p className="text-sm">Loading users…</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">Name</th>
          <th className="py-2">Email</th>
          <th className="py-2">Role</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b">
            <td className="py-2">{row.name}</td>
            <td className="py-2">{row.email}</td>
            <td className="py-2">
              <select
                value={row.role}
                disabled={saving === row.id}
                onChange={(e) => changeRole(row.id, e.target.value as Row["role"])}
                className="border px-2 py-1"
              >
                <option value="STAFF">STAFF</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
