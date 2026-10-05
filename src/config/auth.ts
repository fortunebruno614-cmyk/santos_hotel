/**
 * Guest accounts are an *optional* way to book — see docs/OPEN_QUESTIONS.md #13,
 * which is still open. Neither answer is hardcoded here: both are env flags so
 * the hotel's decision can be flipped without a code change.
 *
 *   GUEST_ACCOUNTS_ENABLED            false -> /signup and POST /api/auth/signup
 *                                      return 403; guest sign-in of existing
 *                                      accounts still works.
 *   GUEST_BOOKING_REQUIRES_ACCOUNT    read by P5 (checkout). false -> a guest can
 *                                      book without an account; true -> booking
 *                                      initiation demands a signed-in guest.
 */
export const GUEST_ACCOUNTS_ENABLED = process.env.GUEST_ACCOUNTS_ENABLED !== "false";
export const GUEST_BOOKING_REQUIRES_ACCOUNT = process.env.GUEST_BOOKING_REQUIRES_ACCOUNT === "true";
