"use client";

import { usePathname } from "next/navigation";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { switchHotel, switchOrganization } from "@/server/auth/tenant-actions";

export function WorkspaceSwitcher({
  organizations,
  hotels,
  currentOrganizationId,
  currentHotelId,
  organizationName,
  hotelName,
}: {
  organizations: Array<{ id: string; name: string }>;
  hotels: Array<{ id: string; name: string }>;
  currentOrganizationId: string;
  currentHotelId: string;
  organizationName: string;
  hotelName: string;
}) {
  const pathname = usePathname() || "/admin";
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left shadow-sm hover:bg-zinc-50">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-[10px] font-semibold text-white">
          <Building2 size={13} />
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[130px] truncate text-[11px] font-semibold text-zinc-800">
            {hotelName}
          </span>
          <span className="block max-w-[130px] truncate text-[9px] text-zinc-400">
            {organizationName}
          </span>
        </span>
        <ChevronsUpDown size={12} className="text-zinc-400" />
      </summary>

      <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
        {organizations.length > 1 && (
          <form action={switchOrganization} className="border-b border-zinc-100 pb-2">
            <p className="px-1 pb-1 text-[9px] font-medium uppercase tracking-wide text-zinc-400">
              Organization
            </p>
            <input type="hidden" name="next" value={pathname} />
            <div className="flex gap-1">
              <select
                name="orgId"
                defaultValue={currentOrganizationId}
                className="h-7 min-w-0 flex-1 rounded border border-zinc-200 px-1.5 text-[11px]"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <button className="rounded border border-zinc-200 px-2 text-[10px] font-medium hover:bg-zinc-50">
                Apply
              </button>
            </div>
          </form>
        )}

        <form action={switchHotel} className="pt-2">
          <p className="px-1 pb-1 text-[9px] font-medium uppercase tracking-wide text-zinc-400">
            Property
          </p>
          <input type="hidden" name="next" value={pathname} />
          <div className="flex gap-1">
            <select
              name="hotelId"
              defaultValue={currentHotelId}
              className="h-7 min-w-0 flex-1 rounded border border-zinc-200 px-1.5 text-[11px]"
            >
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
            <button className="rounded border border-zinc-200 px-2 text-[10px] font-medium hover:bg-zinc-50">
              Apply
            </button>
          </div>
        </form>

        <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-100 px-1 pt-2 text-[9px] text-zinc-400">
          <Check size={10} /> Context is validated against your membership
        </div>
      </div>
    </details>
  );
}
