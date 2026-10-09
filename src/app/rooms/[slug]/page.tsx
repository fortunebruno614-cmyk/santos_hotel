import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { RoomPicker } from "./room-picker";
import { prisma } from "@/lib/prisma";
import { RecordStatus } from "@/generated/prisma/enums";
import { StaySearchSchema } from "@/server/availability/validation";
import { findAvailability } from "@/server/availability/service";
import { parseDateOnly } from "@/server/availability/overlap";

/**
 * Public room-type detail (`/rooms/{slug}`). With search params present it runs
 * the P4 engine for this type only and offers the free rooms; without them it
 * is the same catalogue entry as /rooms with a "check dates" prompt.
 */
export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const roomType = await prisma.roomType.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      amenities: { include: { amenity: true } },
      rooms: { orderBy: { roomNumber: "asc" } },
    },
  });
  if (!roomType || roomType.status !== RecordStatus.ACTIVE) notFound();

  const parsed = StaySearchSchema.safeParse({
    checkIn: sp.checkIn ?? undefined,
    checkOut: sp.checkOut ?? undefined,
    adults: sp.adults ?? undefined,
    children: sp.children ?? undefined,
  });

  let stay: { checkIn: Date; checkOut: Date; adults: number; children: number } | null = null;
  let available: { id: string; roomNumber: string; floor: number | null }[] = [];
  let searchFailed = false;

  if (parsed.success) {
    const checkIn = parseDateOnly(parsed.data.checkIn);
    const checkOut = parseDateOnly(parsed.data.checkOut);
    if (checkIn && checkOut) {
      stay = { checkIn, checkOut, adults: parsed.data.adults, children: parsed.data.children };
      try {
        const result = await findAvailability(stay);
        const type = result.roomTypes.find((candidate) => candidate.id === roomType.id);
        available = (type?.availableRooms ?? []).map((room) => ({
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
        }));
      } catch {
        searchFailed = true;
      }
    }
  }

  const stayQuery = stay
    ? `?checkIn=${stay.checkIn.toISOString().slice(0, 10)}&checkOut=${stay.checkOut
        .toISOString()
        .slice(0, 10)}&adults=${stay.adults}&children=${stay.children}`
    : "";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <Link href="/rooms" className="text-sm text-zinc-500 underline">
          ← All rooms
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{roomType.name}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sleeps {roomType.maxAdults}
            {roomType.maxChildren > 0 ? ` + ${roomType.maxChildren} children` : ""} ·{" "}
            {roomType.rooms.length} rooms · from {roomType.basePrice.toString()} MYR/night
          </p>
        </div>

        {roomType.images.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {roomType.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={image.url}
                alt={image.altText ?? roomType.name}
                className="h-56 w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        {roomType.description && <p className="max-w-prose text-sm">{roomType.description}</p>}

        {roomType.amenities.length > 0 && (
          <section className="space-y-1">
            <h2 className="font-medium">Amenities</h2>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400">
              {roomType.amenities.map((link) => (
                <li key={link.amenityId}>· {link.amenity.name}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3 rounded-xl border border-black/10 p-5 dark:border-white/15">
          <h2 className="font-medium">Available rooms</h2>
          {!stay && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Pick your dates on the{" "}
              <Link href="/search" className="underline">
                search page
              </Link>{" "}
              to see which of these rooms are free and what they cost.
            </p>
          )}
          {stay && searchFailed && (
            <p className="text-sm text-red-600">That stay could not be checked — try again.</p>
          )}
          {stay && !searchFailed && available.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No {roomType.name} rooms are free for those dates.{" "}
              <Link href={`/search${stayQuery}`} className="underline">
                See other room types
              </Link>
              .
            </p>
          )}
          {stay && !searchFailed && available.length > 0 && (
            <RoomPicker
              rooms={available}
              stay={{
                checkIn: stay.checkIn.toISOString().slice(0, 10),
                checkOut: stay.checkOut.toISOString().slice(0, 10),
                adults: stay.adults,
                children: stay.children,
              }}
            />
          )}
        </section>
      </main>
    </>
  );
}
