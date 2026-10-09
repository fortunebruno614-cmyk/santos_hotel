import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/lib/prisma";
import { RecordStatus } from "@/generated/prisma/enums";

/** Public room catalogue — descriptive only; availability/pricing lives in /search. */
export default async function RoomsPage() {
  const roomTypes = await prisma.roomType.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      amenities: { include: { amenity: true } },
      rooms: { select: { id: true } },
    },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Rooms</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Every room type at the hotel. Check dates and live prices on the{" "}
            <Link href="/search" className="underline">
              search page
            </Link>
            .
          </p>
        </div>

        <ul className="space-y-4">
          {roomTypes.map((type) => (
            <li
              key={type.id}
              className="rounded-xl border border-black/10 p-6 dark:border-white/15"
            >
              {type.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={type.images[0].url}
                  alt={type.images[0].altText ?? type.name}
                  className="mb-4 h-48 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">{type.name}</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Sleeps {type.maxAdults}
                    {type.maxChildren > 0 ? ` + ${type.maxChildren} children` : ""} ·{" "}
                    {type.rooms.length} rooms
                  </p>
                  <p className="mt-2 max-w-prose text-sm">{type.description}</p>
                  {type.amenities.length > 0 && (
                    <p className="mt-2 text-sm text-zinc-500">
                      {type.amenities.map((link) => link.amenity.name).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-zinc-500">From</p>
                  <p className="font-medium">
                    {type.basePrice.toString()} MYR
                    <span className="text-sm font-normal text-zinc-500">/night</span>
                  </p>
                  <Link
                    href={`/rooms/${type.slug}`}
                    className="mt-2 inline-block border px-4 py-2 rounded-md text-sm font-medium"
                  >
                    View rooms
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
