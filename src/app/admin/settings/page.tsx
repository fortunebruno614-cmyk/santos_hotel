import { getSettings } from "@/server/console/settings";
import { SettingsForm } from "./settings-form";

/** System settings (P7, admin only): hotel profile + operational policy. */
export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-500">
          Stored on the hotel row and read by pricing, cancellation and the public pages on
          every request. Every change is audited with its old and new values.
        </p>
      </div>
      <SettingsForm
        initial={{
          name: settings.name,
          description: settings.description,
          phone: settings.phone,
          email: settings.email,
          addressLine1: settings.addressLine1,
          addressLine2: settings.addressLine2,
          city: settings.city,
          postcode: settings.postcode,
          country: settings.country,
          timezone: settings.timezone,
          currency: settings.currency,
          checkInTime: settings.checkInTime,
          checkOutTime: settings.checkOutTime,
          taxRatePercent: settings.taxRatePercent,
          serviceFee: settings.serviceFee,
          cancellationWindowHours: settings.cancellationWindowHours,
          guestCancellationEnabled: settings.guestCancellationEnabled,
          maxRoomsPerBooking: settings.maxRoomsPerBooking,
        }}
      />
    </div>
  );
}
