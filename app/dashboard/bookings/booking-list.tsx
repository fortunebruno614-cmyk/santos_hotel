"use client";

import { rooms } from "@/app/data/rooms";

type Booking = {
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
  status: string;
  created_at: string;
  payment_reference: string;
};

function getRoomImage(roomId: number) {
  const room = rooms.find((r) => r.id === roomId);
  return room?.image ?? "";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateICS(booking: Booking) {
  const checkin = new Date(booking.checkin);
  const checkout = new Date(booking.checkout);
  const now = new Date();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Santos Hotel//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTART:${checkin.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTEND:${checkout.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `UID:${booking.id}@santoshotel.com`,
    `SUMMARY:Santos Hotel - ${booking.room_name}`,
    `DESCRIPTION:Booking for ${booking.full_name}. ${booking.guests} guest(s). Total: ₦${Number(booking.total_price).toLocaleString()}. Ref: ${booking.payment_reference || "N/A"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `santos-hotel-${booking.room_name.replace(/\s+/g, "-").toLowerCase()}-${booking.checkin}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateReceipt(booking: Booking) {
  const checkin = new Date(booking.checkin);
  const checkout = new Date(booking.checkout);
  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #23221f; }
        .header { text-align: center; border-bottom: 3px solid #b98a2f; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header h1 span { color: #b98a2f; }
        .header p { color: #6f6c64; margin-top: 6px; }
        .section { margin-bottom: 24px; }
        .section h3 { color: #b98a2f; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #e5e2d8; padding-bottom: 6px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .row .label { color: #6f6c64; font-size: 14px; }
        .row .value { font-weight: 600; font-size: 14px; }
        .total { font-size: 20px; color: #b98a2f; font-weight: 700; text-align: right; margin-top: 20px; padding-top: 16px; border-top: 2px solid #b98a2f; }
        .footer { text-align: center; color: #6f6c64; font-size: 12px; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Santos<span> Hotel</span></h1>
        <p>Booking Receipt</p>
      </div>
      <div class="section">
        <h3>Booking Details</h3>
        <div class="row"><span class="label">Booking ID</span><span class="value">${booking.id.slice(0, 8).toUpperCase()}</span></div>
        <div class="row"><span class="label">Room</span><span class="value">${booking.room_name}</span></div>
        <div class="row"><span class="label">Status</span><span class="value">${booking.status.toUpperCase()}</span></div>
        <div class="row"><span class="label">Payment Ref</span><span class="value">${booking.payment_reference || "N/A"}</span></div>
      </div>
      <div class="section">
        <h3>Stay Details</h3>
        <div class="row"><span class="label">Check-in</span><span class="value">${formatDate(booking.checkin)}</span></div>
        <div class="row"><span class="label">Check-out</span><span class="value">${formatDate(booking.checkout)}</span></div>
        <div class="row"><span class="label">Guests</span><span class="value">${booking.guests}</span></div>
        <div class="row"><span class="label">Nights</span><span class="value">${nights}</span></div>
      </div>
      <div class="section">
        <h3>Guest Info</h3>
        <div class="row"><span class="label">Name</span><span class="value">${booking.full_name}</span></div>
        <div class="row"><span class="label">Email</span><span class="value">${booking.email}</span></div>
        <div class="row"><span class="label">Phone</span><span class="value">${booking.phone}</span></div>
      </div>
      <div class="total">Total: ₦${Number(booking.total_price).toLocaleString()}</div>
      <div class="footer">
        <p>Thank you for choosing Santos Hotel.</p>
        <p>Generated on ${formatDateTime(new Date().toISOString())}</p>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `santos-hotel-receipt-${booking.id.slice(0, 8)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BookingList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="emptyBookings">
        <p>You have no bookings yet.</p>
        <a className="btn btnPrimary" href="/dashboard" style={{ marginTop: 16 }}>
          Browse Rooms
        </a>
      </div>
    );
  }

  return (
    <div className="bookingsList">
      {bookings.map((booking) => {
        const checkin = new Date(booking.checkin);
        const checkout = new Date(booking.checkout);
        const nights = Math.ceil(
          (checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24)
        );
        const image = getRoomImage(booking.room_id);

        return (
          <div key={booking.id} className="bookingItem">
            <div className="bookingItemImage">
              {image && <img src={image} alt={booking.room_name} />}
            </div>
            <div className="bookingItemContent">
              <div className="bookingItemHeader">
                <div>
                  <h3>{booking.room_name}</h3>
                  <span className="bookingDate">
                    Booked {formatDateTime(booking.created_at)}
                  </span>
                </div>
                <span className={`bookingStatus status-${booking.status}`}>
                  {booking.status}
                </span>
              </div>
              <div className="bookingItemDetails">
                <div className="bookingDetail">
                  <span className="detailLabel">Check-in</span>
                  <span className="detailValue">{formatDate(booking.checkin)}</span>
                </div>
                <div className="bookingDetail">
                  <span className="detailLabel">Check-out</span>
                  <span className="detailValue">{formatDate(booking.checkout)}</span>
                </div>
                <div className="bookingDetail">
                  <span className="detailLabel">Guests</span>
                  <span className="detailValue">{booking.guests}</span>
                </div>
                <div className="bookingDetail">
                  <span className="detailLabel">Nights</span>
                  <span className="detailValue">{nights}</span>
                </div>
                <div className="bookingDetail">
                  <span className="detailLabel">Total</span>
                  <span className="detailValue detailTotal">₦{Number(booking.total_price).toLocaleString()}</span>
                </div>
              </div>
              <div className="bookingActions">
                <button className="btn btnSmall" onClick={() => generateICS(booking)}>
                  📅 Add to Calendar
                </button>
                <button className="btn btnSmall" onClick={() => generateReceipt(booking)}>
                  📄 Download Receipt
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
