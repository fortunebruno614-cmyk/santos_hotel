import { after } from "next/server";
import {
  notifyBookingEvent,
  type BookingNotificationEvent,
} from "@/server/notifications/service";

/**
 * Queue notification work after the response is sent.
 *
 * `after()` is the Next.js primitive for post-response work in route handlers,
 * server actions and server components. Outside a request scope (CLI scripts,
 * tests, long-running jobs) it throws, so we fall back to starting the work
 * immediately. Either way the promise is detached and `notifyBookingEvent`
 * swallows its own failures — email can never roll back a booking.
 */
export function scheduleBookingNotification(
  event: BookingNotificationEvent,
  bookingId: string,
  options: { actorKind?: "guest" | "staff"; paymentId?: string | null } = {},
): void {
  const work = async () => {
    try {
      await notifyBookingEvent(event, bookingId, options);
    } catch (error) {
      console.error("scheduled notification failed", { event, bookingId, error });
    }
  };

  try {
    after(work);
  } catch {
    void work();
  }
}
