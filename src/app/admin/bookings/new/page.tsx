import { PageHeader } from "@/components/admin/ui";
import { ManualBookingForm } from "./manual-booking-form";

/** Staff walk-in booking — same engine as public checkout, actor from session. */
export default function NewBookingPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/admin/bookings"
        backLabel="All reservations"
        title="New booking"
        description="Walk-in or phone reservation. Check availability, pick the rooms and let the server price the stay before confirming."
      />
      <ManualBookingForm />
    </div>
  );
}
