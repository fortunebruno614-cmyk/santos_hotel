import Link from "next/link";
import { getConsoleContext } from "@/server/console/context";
import { Permissions } from "@/server/auth/roles";
import { HotelCreateForm } from "./hotel-form";

const MESSAGES: Record<string, string> = {
  conflict: "That public slug is already used by another property.",
  invalid_body: "Please check the property details.",
  not_found: "The organization could not be found.",
  internal: "The property could not be created.",
};

export default async function NewHotelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  await getConsoleContext(Permissions.MANAGE_HOTELS);
  const error = MESSAGES[sp.error ?? ""] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/hotels" className="text-sm underline">
          ← Hotels
        </Link>
        <h1 className="text-2xl font-semibold">Add a property</h1>
        <p className="text-sm text-zinc-500">
          Business information, address and verified map position. Rooms and rates are added
          after the property exists.
        </p>
      </div>
      <HotelCreateForm error={error} />
    </div>
  );
}
