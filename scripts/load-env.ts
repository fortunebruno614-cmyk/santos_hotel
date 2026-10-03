import { config } from "dotenv";

// Keep the same precedence as Next.js and prisma7.config.ts:
// per-machine overrides in .env.local win over the shared baseline in .env.
config({ path: [".env.local", ".env"] });
