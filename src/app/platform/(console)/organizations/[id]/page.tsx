import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizationDetail } from "@/server/platform/organizations";
import { setOrganizationStatusAction } from "@/server/platform/actions";
import { PlatformHotelForm } from "./hotel-form";

export default async function PlatformOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organization = await getOrganizationDetail(id);
  if (!organization) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/platform" className="text-sm underline">
            ← Organizations
          </Link>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          <p className="text-sm text-zinc-500">
            {organization.slug} · {organization.status} · {organization.email ?? "no e-mail"}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={setOrganizationStatusAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <input type="hidden" name="status" value="ACTIVE" />
            <button className="border px-3 py-1 rounded-md text-sm">Activate</button>
          </form>
          <form action={setOrganizationStatusAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <input type="hidden" name="status" value="SUSPENDED" />
            <button className="border px-3 py-1 rounded-md text-sm">Suspend</button>
          </form>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Properties</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Slug</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Currency</th>
                <th className="py-2">Publication</th>
              </tr>
            </thead>
            <tbody>
              {organization.hotels.map((hotel) => (
                <tr key={hotel.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Link href={`/platform/hotels/${hotel.id}`} className="underline">
                      {hotel.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{hotel.slug}</td>
                  <td className="py-2 pr-4">
                    {hotel.city ?? "—"}, {hotel.country ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{hotel.currency}</td>
                  <td className="py-2">{hotel.publicationStatus}</td>
                </tr>
              ))}
              {organization.hotels.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-zinc-500">
                    No properties yet — add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PlatformHotelForm organizationId={organization.id} />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Members</h2>
        <ul className="space-y-1 text-sm">
          {organization.members.map((member) => (
            <li key={member.id}>
              {member.user.name} ({member.user.email}) · {member.role} · {member.status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
