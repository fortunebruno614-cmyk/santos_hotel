import { config } from "dotenv";

// Keep the same precedence as Next.js and prisma7.config.ts:
// per-machine overrides in .env.local win over the shared baseline in .env.
config({ path: [".env.local", ".env"] });

// Hard safety: the test suite creates real bookings/payments. It must never
// send real Resend email or write delivery rows while exercising that workflow.
const isTestRunner =
  process.env.NODE_TEST_CONTEXT !== undefined ||
  process.env.npm_lifecycle_event === "test" ||
  process.argv.some((arg) => arg === "--test");
if (isTestRunner) process.env.EMAIL_ENABLED = "false";
