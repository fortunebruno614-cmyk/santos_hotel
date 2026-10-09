import Link from "next/link";
import { ManualBookingForm } from "./manual-booking-form";

/** Staff walk-in booking — same engine as public checkout, actor from session. */
export default function NewBookingPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New booking</h1>
        <Link href="/admin/bookings" className="text-sm underline">
          ← All reservations
        </Link>
      </div>
      <ManualBookingForm />
    </div>
  );
}
