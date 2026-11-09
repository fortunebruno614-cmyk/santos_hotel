import { Permissions } from "@/server/auth/roles";
import { configuredAdminEmails, resendFromEmail } from "@/config/email";
import { getConsoleContext } from "@/server/console/context";
import { listRecentNotifications } from "@/server/notifications/service";
import { NotificationTestForm } from "./notification-test-form";

const STATUS_STYLES: Record<string, string> = {
  SENT: "text-emerald-700",
  PENDING: "text-amber-700",
  FAILED: "text-red-700",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Email delivery log (admin only): what was sent, skipped or failed. */
export default async function AdminNotificationsPage() {
  const { session, hotel } = await getConsoleContext(Permissions.MANAGE_SETTINGS);
  const notifications = await listRecentNotifications(hotel.id, 50);
  const defaultRecipient = configuredAdminEmails()[0] ?? session.email ?? null;
  const usingTestSender = resendFromEmail().includes("onboarding@resend.dev");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-zinc-500">
          Guest and administrator emails sent through Resend. Delivery failures are recorded
          here and never block a booking or payment.
        </p>
      </div>

      <NotificationTestForm defaultEmail={defaultRecipient} />

      {usingTestSender && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <strong>Resend test sender in use.</strong> You can only send to the Resend
          account owner until a sending domain is verified. Verify a domain at
          resend.com/domains and set <code>RESEND_FROM_EMAIL</code> before sending to
          guests.
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Recipient</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No notification emails yet.
                </td>
              </tr>
            ) : (
              notifications.map((notification) => (
                <tr key={notification.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {formatDate(notification.createdAt)}
                  </td>
                  <td
                    className={`px-3 py-2 text-xs font-medium ${
                      STATUS_STYLES[notification.status] ?? "text-zinc-600"
                    }`}
                  >
                    {notification.status}
                  </td>
                  <td className="px-3 py-2 text-xs break-all">{notification.recipient}</td>
                  <td className="px-3 py-2 text-xs max-w-xs">
                    {notification.subject ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {notification.booking?.bookingReference ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-700 max-w-xs break-words">
                    {notification.error ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {notifications.some((notification) => notification.status === "FAILED") && (
        <p className="text-xs text-zinc-500">
          Failed messages are safe to retry from the booking/payment workflow once the Resend
          configuration is corrected; the dedupe key prevents duplicate sends.
        </p>
      )}
    </div>
  );
}
