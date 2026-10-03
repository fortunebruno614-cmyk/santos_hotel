import "./load-env";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (checked .env.local, .env).");
  process.exit(1);
}

const file = path.join(process.cwd(), "dumps", "santos_hotel.dump");
if (!existsSync(file)) {
  console.error("dumps/santos_hotel.dump not found. Pull latest main or run npm run db:dump.");
  process.exit(1);
}

console.warn("Restoring will drop and recreate objects in the target database.");

const result = spawnSync(
  "pg_restore",
  ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", url, file],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(
    "pg_restore not found. Install the PostgreSQL client tools (brew install libpq or postgresql).",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
