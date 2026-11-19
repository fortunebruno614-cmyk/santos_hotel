import {
  EmptyRow,
  Notice,
  PageHeader,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { Permissions } from "@/server/auth/roles";
import { configuredAdminEmails, resendFromEmail } from "@/config/email";
import { getConsoleContext } from "@/server/console/context";
import { listRecentNotifications } from "@/server/notifications/service";
import { NotificationTestForm } from "./notification-test-form";

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
      <PageHeader
        title="Notifications"
        description="Guest and administrator emails sent through Resend. Delivery failures are recorded here and never block a booking or payment."
      />

      {usingTestSender && (
        <Notice tone="warning" title="Resend test sender in use">
          You can only send to the Resend account owner until a sending domain is verified. Verify
          a domain at resend.com/domains and set <code>RESEND_FROM_EMAIL</code> before sending to
          guests.
        </Notice>
      )}

      <NotificationTestForm defaultEmail={defaultRecipient} />

      <TableShell>
        <thead>
          <tr>
            <th>Created</th>
            <th>Status</th>
            <th>Recipient</th>
            <th>Subject</th>
            <th>Booking</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {notifications.length === 0 ? (
            <EmptyRow colSpan={6}>No notification emails yet.</EmptyRow>
          ) : (
            notifications.map((notification) => (
              <tr key={notification.id}>
                <td className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(notification.createdAt)}
                </td>
                <td>
                  <StatusBadge status={notification.status} />
                </td>
                <td className="break-all text-xs">{notification.recipient}</td>
                <td className="max-w-xs text-xs">{notification.subject ?? "—"}</td>
                <td className="whitespace-nowrap text-xs">
                  {notification.booking?.bookingReference ?? "—"}
                </td>
                <td className="max-w-xs break-words text-xs text-red-700">
                  {notification.error ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {notifications.some((notification) => notification.status === "FAILED") && (
        <p className="text-xs text-muted-foreground">
          Failed messages are safe to retry from the booking/payment workflow once the Resend
          configuration is corrected; the dedupe key prevents duplicate sends.
        </p>
      )}
    </div>
  );
}
