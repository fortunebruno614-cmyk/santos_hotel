import { Resend } from "resend";
import { rooms } from "@/app/data/rooms";

const resend = new Resend(process.env.RESEND_API_KEY);

const HOTEL_ADDRESS = "Santos Hotel, Lagos, Nigeria";
const GOOGLE_MAPS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(HOTEL_ADDRESS)}`;

function generateICS(booking: {
  room_name: string;
  checkin: string;
  checkout: string;
  full_name: string;
  total_price: number;
  id: string;
}) {
  const checkin = new Date(booking.checkin);
  const checkout = new Date(booking.checkout);
  const now = new Date();

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Santos Hotel//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTART:${checkin.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTEND:${checkout.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `UID:${booking.id}@santoshotel.com`,
    `SUMMARY:Santos Hotel - ${booking.room_name}`,
    `DESCRIPTION:Booking for ${booking.full_name}. Total: ₦${Number(booking.total_price).toLocaleString()}`,
    `LOCATION:${HOTEL_ADDRESS}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendBookingEmail(booking: {
  id: string;
  room_id: number;
  room_name: string;
  checkin: string;
  checkout: string;
  guests: number;
  full_name: string;
  email: string;
  phone: string;
  total_price: number;
  payment_reference: string;
}) {
  const room = rooms.find((r) => r.id === booking.room_id);
  const nights = Math.ceil(
    (new Date(booking.checkout).getTime() - new Date(booking.checkin).getTime()) / (1000 * 60 * 60 * 24)
  );
  const icsContent = generateICS(booking);
  const icsBase64 = Buffer.from(icsContent).toString("base64");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#fafaf7;font-family:Arial,Helvetica,sans-serif;color:#23221f;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;">

        <!-- Header -->
        <div style="background:#b98a2f;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:#ffffff;font-weight:700;">
            Santos<span style="color:#fff3e0;"> Hotel</span>
          </h1>
          <p style="margin:6px 0 0;color:#fff3e0;font-size:14px;">Booking Confirmation</p>
        </div>

        <!-- Success Banner -->
        <div style="background:#e8f5e9;padding:24px 40px;text-align:center;">
          <div style="font-size:36px;color:#2e7d32;margin-bottom:8px;">✓</div>
          <h2 style="margin:0;color:#2e7d32;font-size:22px;">Booking Confirmed!</h2>
          <p style="margin:6px 0 0;color:#555;font-size:14px;">Thank you, ${booking.full_name}. Your reservation is confirmed.</p>
        </div>

        <!-- Room Image -->
        ${room ? `
        <div style="padding:0 40px;margin-top:24px;">
          <img src="${room.image}" alt="${booking.room_name}" style="width:100%;height:220px;object-fit:cover;border-radius:12px;" />
        </div>
        ` : ""}

        <!-- Booking Details -->
        <div style="padding:24px 40px;">
          <h3 style="color:#b98a2f;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;border-bottom:1px solid #e5e2d8;padding-bottom:8px;">Booking Details</h3>

          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Booking ID</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${booking.id.slice(0, 8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Room</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${booking.room_name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Status</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;color:#2e7d32;">CONFIRMED</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Payment Ref</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${booking.payment_reference}</td>
            </tr>
          </table>
        </div>

        <!-- Stay Details -->
        <div style="padding:0 40px 24px;">
          <h3 style="color:#b98a2f;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;border-bottom:1px solid #e5e2d8;padding-bottom:8px;">Stay Details</h3>

          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Check-in</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${formatDate(booking.checkin)}, 2:00 PM</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Check-out</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${formatDate(booking.checkout)}, 12:00 PM</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Guests</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${booking.guests}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6f6c64;font-size:14px;">Nights</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;text-align:right;">${nights}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:#6f6c64;font-size:14px;font-weight:600;border-top:2px solid #b98a2f;">Total Paid</td>
              <td style="padding:12px 0;font-weight:700;font-size:20px;text-align:right;color:#b98a2f;border-top:2px solid #b98a2f;">₦${Number(booking.total_price).toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <!-- Location & Map -->
        <div style="padding:0 40px 24px;">
          <h3 style="color:#b98a2f;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;border-bottom:1px solid #e5e2d8;padding-bottom:8px;">Location</h3>
          <p style="margin:0 0 12px;font-size:14px;color:#6f6c64;">${HOTEL_ADDRESS}</p>
          <a href="${GOOGLE_MAPS_URL}" target="_blank" style="display:inline-block;background:#b98a2f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">📍 Get Directions on Google Maps</a>
        </div>

        <!-- CTA Buttons -->
        <div style="padding:0 40px 32px;text-align:center;">
          <a href="http://localhost:3000/dashboard/bookings" style="display:inline-block;background:#b98a2f;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;margin:0 6px;">View My Bookings</a>
          <a href="http://localhost:3000/dashboard" style="display:inline-block;background:#ffffff;color:#23221f;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;border:1px solid #e5e2d8;margin:0 6px;">Dashboard</a>
        </div>

        <!-- Footer -->
        <div style="background:#f5f0e6;padding:24px 40px;text-align:center;border-top:1px solid #e5e2d8;">
          <p style="margin:0;color:#6f6c64;font-size:13px;">© ${new Date().getFullYear()} Santos Hotel. All rights reserved.</p>
          <p style="margin:6px 0 0;color:#6f6c64;font-size:12px;">This email was sent to ${booking.email}</p>
        </div>

      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "Santos Hotel <fortunbruno614@gmail.com>",
    to: booking.email,
    subject: `Booking Confirmed - ${booking.room_name} | Santos Hotel`,
    html,
    attachments: [
      {
        filename: `santos-hotel-${booking.room_name.replace(/\s+/g, "-").toLowerCase()}-${booking.checkin}.ics`,
        content: icsBase64,
        contentType: "text/calendar",
      },
    ],
  });
}
