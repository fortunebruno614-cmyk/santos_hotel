import { PageHeader } from "@/components/admin/ui";
import { getSettings } from "@/server/console/settings";
import { getConsoleContext } from "@/server/console/context";
import { getOrganizationKycSummary } from "@/server/onboarding/kyc";
import { isDemoMapLocation } from "@/config/maps";
import { SettingsForm } from "./settings-form";

/** System settings (P7, admin only): hotel profile + operational policy. */
export default async function AdminSettingsPage() {
  const { hotel, member } = await getConsoleContext();
  const [settings, kyc] = await Promise.all([
    getSettings(hotel.id),
    getOrganizationKycSummary(member.organizationId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Stored on the hotel row and read by pricing, cancellation and the public pages on every request. Every change is audited with its old and new values."
      />
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
          latitude: settings.latitude,
          longitude: settings.longitude,
        }}
        kyc={kyc}
        demoMapLocation={isDemoMapLocation()}
      />
    </div>
  );
}
