import { appUrl } from "@/config/email";

/**
 * Santos Hotel branded email templates.
 *
 * Deliberately dependency-free HTML with inline styles and table layout so it
 * renders consistently in Gmail, Outlook and Apple Mail. The logo is a styled
 * text lockup rather than an image: it always renders, even when a client
 * blocks remote images.
 */

export type EmailBooking = {
  id: string;
  bookingReference: string;
  guestName: string;
  guestEmail: string | null;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  bookingStatus: string;
  paymentStatus: string;
  currency: string;
  total: string;
  rooms: Array<{ roomTypeName: string; roomNumber: string }>;
  createdAt: Date;
};

export type EmailHotel = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
};

export type EmailPayment = {
  id: string;
  amount: string;
  currency: string;
  provider: string;
  paidAt: Date | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const BRAND = {
  navy: "#1f3448",
  gold: "#b08d57",
  cream: "#f6f1e7",
  border: "#e4ddd0",
  muted: "#6b7280",
};

const BOOKING_STATUS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function guestCount(booking: EmailBooking): string {
  const adults = `${booking.adults} adult${booking.adults === 1 ? "" : "s"}`;
  const children = `${booking.children} child${booking.children === 1 ? "" : "ren"}`;
  return `${adults}, ${children}`;
}

function roomSummary(booking: EmailBooking, includeNumbers = false): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const room of booking.rooms) {
    if (seen.has(room.roomTypeName)) continue;
    seen.add(room.roomTypeName);
    names.push(
      includeNumbers && room.roomNumber
        ? `${room.roomTypeName} (room ${room.roomNumber})`
        : room.roomTypeName,
    );
  }
  return names.length > 0 ? names.join(", ") : "Santo Hotel stay";
}

function hotelAddress(hotel: EmailHotel): string {
  return [
    hotel.addressLine1,
    hotel.addressLine2,
    hotel.city,
    hotel.postcode,
    hotel.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function bookingRows(
  booking: EmailBooking,
  hotel: EmailHotel,
  options: { includeRoomNumbers?: boolean; includePaymentStatus?: boolean } = {},
): Array<{ label: string; value: string }> {
  return [
    { label: "Guest", value: booking.guestName },
    { label: "Booking reference", value: booking.bookingReference },
    { label: "Room type", value: roomSummary(booking, options.includeRoomNumbers) },
    {
      label: "Check-in",
      value: `${formatDate(booking.checkIn)} · after ${hotel.checkInTime}`,
    },
    {
      label: "Check-out",
      value: `${formatDate(booking.checkOut)} · before ${hotel.checkOutTime}`,
    },
    { label: "Guests", value: guestCount(booking) },
    { label: "Booking status", value: BOOKING_STATUS[booking.bookingStatus] ?? booking.bookingStatus },
    ...(options.includePaymentStatus
      ? [{ label: "Payment", value: PAYMENT_STATUS[booking.paymentStatus] ?? booking.paymentStatus }]
      : []),
    { label: "Total", value: formatMoney(booking.total, booking.currency) },
  ];
}

function layout(input: {
  preheader: string;
  heading: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  cta?: { label: string; href: string } | null;
  note?: string;
  attention?: string | null;
  hotel: EmailHotel;
}): string {
  const rows = input.rows
    .map(
      (row, index) => `
        <tr>
          <td style="padding:11px 0;border-bottom:${index === input.rows.length - 1 ? "0" : `1px solid ${BRAND.border}`};font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};vertical-align:top;width:38%;">${escapeHtml(row.label)}</td>
          <td style="padding:11px 0 11px 16px;border-bottom:${index === input.rows.length - 1 ? "0" : `1px solid ${BRAND.border}`};font-size:13px;line-height:1.5;color:${BRAND.navy};font-weight:600;word-break:break-word;vertical-align:top;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 4px;">
         <tr>
           <td style="border-radius:4px;background:${BRAND.navy};">
             <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-decoration:none;">${escapeHtml(input.cta.label)}</a>
           </td>
         </tr>
       </table>`
    : "";

  const attention = input.attention
    ? `<div style="margin:0 0 22px;padding:13px 16px;border-left:3px solid ${BRAND.gold};background:#fbf7ef;color:#5c4a2f;font-size:12px;line-height:1.6;">${escapeHtml(input.attention)}</div>`
    : "";

  const address = hotelAddress(input.hotel);
  const contact = [
    input.hotel.phone ? `<a href="tel:${escapeHtml(input.hotel.phone)}" style="color:${BRAND.navy};text-decoration:none;">${escapeHtml(input.hotel.phone)}</a>` : "",
    input.hotel.email ? `<a href="mailto:${escapeHtml(input.hotel.email)}" style="color:${BRAND.navy};text-decoration:none;">${escapeHtml(input.hotel.email)}</a>` : "",
    `<a href="${escapeHtml(appUrl())}" style="color:${BRAND.navy};text-decoration:none;">${escapeHtml(appUrl().replace(/^https?:\/\//, ""))}</a>`,
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(input.heading)}</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-shell { width:100% !important; }
      .email-pad { padding:26px 22px !important; }
      .email-heading { font-size:26px !important; }
      .email-detail-label, .email-detail-value { display:block !important; width:100% !important; padding-left:0 !important; }
      .email-detail-value { padding-top:3px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="height:5px;background:${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:28px 38px 22px;border-bottom:1px solid ${BRAND.border};">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1;letter-spacing:2px;color:${BRAND.navy};font-weight:600;">SANTO<span style="color:${BRAND.gold};">.</span></div>
              <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:6px;color:#8a8f98;">H O T E L</div>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:32px 38px 34px;">
              <h1 class="email-heading" style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:31px;line-height:1.2;font-weight:400;color:${BRAND.navy};">${escapeHtml(input.heading)}</h1>
              <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#4b5563;">${escapeHtml(input.intro)}</p>
              ${attention}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
                ${rows}
              </table>
              ${cta}
              ${input.note ? `<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:${BRAND.muted};">${escapeHtml(input.note)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:22px 38px 26px;background:#fbf8f2;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${BRAND.navy};">${escapeHtml(input.hotel.name)}</p>
              ${address ? `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(address)}</p>` : ""}
              <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:${BRAND.muted};">${contact}</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:1.6;color:#9aa0a6;">This is an automated message from ${escapeHtml(input.hotel.name)}. Please do not reply directly to this address if a different contact is listed above.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#9aa0a6;">© ${new Date().getFullYear()} ${escapeHtml(input.hotel.name)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function plainText(lines: Array<string | null | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function reservationUrl(reference: string): string {
  return `${appUrl()}/booking/confirmation?ref=${encodeURIComponent(reference)}`;
}

function adminBookingUrl(bookingId: string): string {
  return `${appUrl()}/admin/bookings/${encodeURIComponent(bookingId)}`;
}

export function renderGuestEmail(
  kind: "received" | "confirmed" | "cancelled" | "payment",
  booking: EmailBooking,
  hotel: EmailHotel,
  payment?: EmailPayment | null,
): RenderedEmail {
  const rows = bookingRows(booking, hotel, {
    includePaymentStatus: kind === "payment" || kind === "cancelled",
  });
  if (kind === "payment" && payment) {
    rows.push(
      { label: "Amount paid", value: formatMoney(payment.amount, payment.currency) },
      { label: "Payment method", value: payment.provider },
      { label: "Paid at", value: formatDateTime(payment.paidAt) },
    );
  }

  const config = {
    received: {
      subject: `${hotel.name}: reservation ${booking.bookingReference} received`,
      heading: "We have your reservation.",
      intro: `Thank you, ${booking.guestName}. Your reservation is with our front desk and we will confirm it shortly. Your reference is ${booking.bookingReference}.`,
      preheader: `Reservation ${booking.bookingReference} received — we will confirm it shortly.`,
      note: "Your room is being held while we process the reservation. If you did not make this booking, please contact us immediately.",
    },
    confirmed: {
      subject: `${hotel.name}: reservation ${booking.bookingReference} confirmed`,
      heading: "Your stay is confirmed.",
      intro: `We look forward to welcoming you, ${booking.guestName}. Your reservation is confirmed and the details are below.`,
      preheader: `Reservation ${booking.bookingReference} is confirmed.`,
      note: `Check-in begins at ${hotel.checkInTime}. If your plans change, contact us as early as possible.`,
    },
    cancelled: {
      subject: `${hotel.name}: reservation ${booking.bookingReference} cancelled`,
      heading: "Your reservation is cancelled.",
      intro: `This confirms that reservation ${booking.bookingReference} for ${booking.guestName} has been cancelled.`,
      preheader: `Reservation ${booking.bookingReference} has been cancelled.`,
      note: "If you did not request this cancellation, please contact the hotel immediately.",
    },
    payment: {
      subject: `${hotel.name}: payment received for ${booking.bookingReference}`,
      heading: "Payment received.",
      intro: `Thank you, ${booking.guestName}. We have received your payment for reservation ${booking.bookingReference}.`,
      preheader: `Payment received for reservation ${booking.bookingReference}.`,
      note: booking.bookingStatus === "CONFIRMED"
        ? "Your reservation is confirmed. We look forward to welcoming you."
        : "We will update your reservation as soon as the payment is fully processed.",
    },
  }[kind];

  return {
    subject: config.subject,
    html: layout({
      preheader: config.preheader,
      heading: config.heading,
      intro: config.intro,
      rows,
      cta: {
        label: kind === "cancelled" ? "Book another stay" : "View your reservation",
        href: kind === "cancelled" ? `${appUrl()}/rooms` : reservationUrl(booking.bookingReference),
      },
      note: config.note,
      hotel,
    }),
    text: plainText([
      config.heading,
      "",
      config.intro,
      "",
      ...rows.map((row) => `${row.label}: ${row.value}`),
      "",
      kind === "cancelled"
        ? `Book another stay: ${appUrl()}/rooms`
        : `View your reservation: ${reservationUrl(booking.bookingReference)}`,
      "",
      config.note,
      "",
      `${hotel.name}${hotel.phone ? ` · ${hotel.phone}` : ""}${hotel.email ? ` · ${hotel.email}` : ""}`,
      hotelAddress(hotel),
    ]),
  };
}

export function renderAdminEmail(
  kind: "new" | "cancelled" | "payment",
  booking: EmailBooking,
  hotel: EmailHotel,
  payment?: EmailPayment | null,
): RenderedEmail {
  const rows = bookingRows(booking, hotel, {
    includeRoomNumbers: true,
    includePaymentStatus: true,
  });
  if (kind === "payment" && payment) {
    rows.push(
      { label: "Amount received", value: formatMoney(payment.amount, payment.currency) },
      { label: "Payment method", value: payment.provider },
      { label: "Paid at", value: formatDateTime(payment.paidAt) },
    );
  }

  const config = {
    new: {
      subject: `New reservation ${booking.bookingReference} — ${booking.guestName}`,
      heading: "New reservation.",
      intro: `${booking.guestName} has booked ${roomSummary(booking, true)} for ${formatDate(
        booking.checkIn,
      )} to ${formatDate(booking.checkOut)}.`,
      preheader: `New reservation ${booking.bookingReference} from ${booking.guestName}.`,
      attention:
        booking.bookingStatus === "PENDING" || booking.paymentStatus === "PENDING"
          ? "This reservation is still pending payment. Please review it in the admin console."
          : null,
      note: "You are receiving this because a new reservation was created.",
    },
    cancelled: {
      subject: `Guest cancelled ${booking.bookingReference} — ${booking.guestName}`,
      heading: "Guest cancelled a reservation.",
      intro: `${booking.guestName} cancelled reservation ${booking.bookingReference} for ${roomSummary(
        booking,
        true,
      )}.`,
      preheader: `Reservation ${booking.bookingReference} was cancelled by the guest.`,
      attention: "The dates have been released back to availability.",
      note: "Review the reservation for any refund or follow-up action.",
    },
    payment: {
      subject: `Payment received ${booking.bookingReference} — ${formatMoney(
        payment?.amount ?? booking.total,
        payment?.currency ?? booking.currency,
      )}`,
      heading: "Payment received.",
      intro: `${booking.guestName} paid for reservation ${booking.bookingReference}.`,
      preheader: `Payment received for ${booking.bookingReference}.`,
      attention: null,
      note: "The payment ledger has been updated. This is an automated notification.",
    },
  }[kind];

  return {
    subject: config.subject,
    html: layout({
      preheader: config.preheader,
      heading: config.heading,
      intro: config.intro,
      rows,
      cta: { label: "Open in admin", href: adminBookingUrl(booking.id) },
      note: config.note,
      attention: config.attention ?? null,
      hotel,
    }),
    text: plainText([
      config.heading,
      "",
      config.intro,
      "",
      ...rows.map((row) => `${row.label}: ${row.value}`),
      "",
      `Open in admin: ${adminBookingUrl(booking.id)}`,
      "",
      config.note,
    ]),
  };
}

export function renderTestEmail(hotel: EmailHotel, recipient: string): RenderedEmail {
  const now = formatDateTime(new Date());
  return {
    subject: `${hotel.name}: Resend email delivery test`,
    html: layout({
      preheader: "Resend is configured correctly for Santos Hotel notifications.",
      heading: "Email delivery is working.",
      intro: `This test message confirms that ${hotel.name} can send transactional email through Resend. It was sent to ${recipient}.`,
      rows: [
        { label: "Recipient", value: recipient },
        { label: "Sent at", value: now },
        { label: "Provider", value: "Resend" },
      ],
      cta: { label: "Open the hotel website", href: appUrl() },
      note: "No booking or guest data was included in this test.",
      hotel,
    }),
    text: plainText([
      "Email delivery is working.",
      "",
      `This test message confirms that ${hotel.name} can send transactional email through Resend. It was sent to ${recipient}.`,
      "",
      `Recipient: ${recipient}`,
      `Sent at: ${now}`,
      "Provider: Resend",
      "",
      `Website: ${appUrl()}`,
    ]),
  };
}
