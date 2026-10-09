import "../../scripts/load-env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Env-flag behaviour of checkout (docs/OPEN_QUESTIONS.md #13). Each test file
 * runs in its own process, so the flag is set before the first import of
 * `src/config/auth` — which reads `process.env` at module load.
 */

process.env.GUEST_BOOKING_REQUIRES_ACCOUNT = "true";

describe("P5 checkout with GUEST_BOOKING_REQUIRES_ACCOUNT=true", () => {
  it("refuses anonymous checkout but still books for a signed-in guest", async () => {
    const { createBooking, BookingError } = await import("../../src/server/booking/service");
    const { GUEST_BOOKING_REQUIRES_ACCOUNT } = await import("../../src/config/auth");
    const { BOOKING_TEST_SUFFIX, deleteTestBookingGuests, loadInventory, prisma } = await import(
      "../helpers"
    );

    assert.equal(GUEST_BOOKING_REQUIRES_ACCOUNT, true, "flag must be on before config loads");

    const inventory = await loadInventory();
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    const email = `requires-account${BOOKING_TEST_SUFFIX}`;
    await deleteTestBookingGuests();
    const guest = await prisma.guest.create({
      data: { firstName: "P5", lastName: "Account", email },
    });

    await assert.rejects(
      createBooking(
        {
          checkIn: "2027-08-01",
          checkOut: "2027-08-03",
          adults: 2,
          children: 0,
          roomIds: [room.id],
          guest: { firstName: "No", lastName: "Account", email },
        },
        { kind: "anonymous" },
      ),
      (error: unknown) => error instanceof BookingError && error.code === "account_required",
    );

    const booking = await createBooking(
      {
        checkIn: "2027-08-01",
        checkOut: "2027-08-03",
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "P5", lastName: "Account", email },
      },
      { kind: "guest", guestId: guest.id },
    );
    assert.equal(booking.guestId, guest.id);

    await deleteTestBookingGuests();
  });
});
