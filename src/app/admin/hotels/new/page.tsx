import { PageHeader } from "@/components/admin/ui";
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
    <div className="space-y-5">
      <PageHeader
        backHref="/admin/hotels"
        backLabel="Hotels"
        title="Add a property"
        description="Business information, address and verified map position. Rooms and rates are added after the property exists."
      />
      <HotelCreateForm error={error} />
    </div>
  );
}
