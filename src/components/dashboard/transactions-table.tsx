"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import type { TransactionRow } from "@/server/console/analytics";
import { formatMoney } from "./ui";

const PAGE_SIZE = 8;
const STATUSES = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  CHECKED_IN: "bg-blue-50 text-blue-700 ring-blue-600/15",
  CHECKED_OUT: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
  CANCELLED: "bg-red-50 text-red-700 ring-red-600/15",
  NO_SHOW: "bg-amber-50 text-amber-700 ring-amber-600/15",
  PENDING: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
};

export function TransactionsTable({
  rows,
  timezone,
}: {
  rows: TransactionRow[];
  timezone: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">(
    "date-desc",
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!search) return true;
      return (
        row.reference.toLowerCase().includes(search) ||
        row.customer.toLowerCase().includes(search) ||
        row.category.toLowerCase().includes(search)
      );
    });
    result.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return a.date.localeCompare(b.date);
        case "amount-desc":
          return b.amount - a.amount;
        case "amount-asc":
          return a.amount - b.amount;
        default:
          return b.date.localeCompare(a.date);
      }
    });
    return result;
  }, [rows, query, status, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSelected) {
      for (const row of pageRows) next.delete(row.id);
    } else {
      for (const row of pageRows) next.add(row.id);
    }
    setSelected(next);
  };

  const exportSelected = () => {
    const chosen = filtered.filter((row) => selected.has(row.id));
    const header = ["Reference", "Customer", "Date", "Category", "Status", "Amount", "Currency"];
    const lines = chosen.map((row) =>
      [
        row.reference,
        row.customer,
        row.date,
        row.category,
        row.status,
        row.amount.toFixed(2),
        row.currency,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "selected-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <label className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search transactions…"
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-xs text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-600 outline-none focus:border-zinc-300"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === "ALL" ? "All statuses" : value.replaceAll("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportSelected}
          disabled={selected.size === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={13} />
          Export{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-400">
              <th className="w-8 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select page"
                  className="h-3.5 w-3.5 rounded border-zinc-300"
                />
              </th>
              <th className="px-2 py-2 font-medium">Reference</th>
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-zinc-600"
                  onClick={() => setSort(sort === "amount-desc" ? "amount-asc" : "amount-desc")}
                >
                  Amount <ArrowUpDown size={11} />
                </button>
              </th>
              <th className="w-10 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      setSelected(next);
                    }}
                    aria-label={`Select ${row.reference}`}
                    className="h-3.5 w-3.5 rounded border-zinc-300"
                  />
                </td>
                <td className="px-2 py-2.5 font-mono text-[11px] text-zinc-700">{row.reference}</td>
                <td className="max-w-[150px] truncate px-2 py-2.5 text-zinc-700">{row.customer}</td>
                <td className="px-2 py-2.5 whitespace-nowrap text-zinc-500">
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: timezone,
                  }).format(new Date(row.date))}
                </td>
                <td className="px-2 py-2.5 text-zinc-500">{row.category}</td>
                <td className="px-2 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                      STATUS_STYLES[row.status] ?? STATUS_STYLES.PENDING
                    }`}
                  >
                    {row.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums text-zinc-800">
                  {formatMoney(row.amount, row.currency, 0)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/bookings/${row.bookingId}`}
                    className="text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                  <p className="font-medium text-zinc-700">No transactions in this view</p>
                  <p className="mt-1 text-[11px]">
                    Try another search, status or date range.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2.5 text-[11px] text-zinc-500">
        <span>
          {filtered.length === 0
            ? "0 transactions"
            : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                safePage * PAGE_SIZE,
                filtered.length,
              )} of ${filtered.length}`}
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-1 tabular-nums">
            {safePage} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pages, safePage + 1))}
            disabled={safePage >= pages}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
