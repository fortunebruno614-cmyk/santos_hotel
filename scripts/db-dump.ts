import "./load-env";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (checked .env.local, .env).");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "dumps");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "santos_hotel.dump");

console.log(`Dumping ${new URL(url).pathname.slice(1)} → dumps/santos_hotel.dump`);

const result = spawnSync(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-privileges", "--file", outFile, url],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(
    "pg_dump not found. Install the PostgreSQL client tools (brew install libpq or postgresql).",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
