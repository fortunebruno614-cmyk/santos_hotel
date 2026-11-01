import "./load-env";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { postgresConnection } from "./postgres-cli";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (checked .env.local, .env).");

  const args = process.argv.slice(2);
  if (args.some((argument) => !argument.startsWith("--output="))) {
    throw new Error("Usage: npm run mt:backup [-- --output=dumps/multi-tenant/backup.dump]");
  }
  const defaultName = `backup-${new Date().toISOString().replace(/:/g, "-")}.dump`;
  const outputPath = path.resolve(process.cwd(), option("output") ?? path.join("dumps", "multi-tenant", defaultName));
  const manifestPath = `${outputPath}.json`;
  if (existsSync(outputPath) || existsSync(manifestPath)) {
    throw new Error("Backup output or manifest already exists; choose a new --output path.");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const connection = postgresConnection(databaseUrl);

  const result = spawnSync(
    "pg_dump",
    ["--no-password", "--format=custom", "--no-owner", "--no-privileges", "--file", outputPath, connection.connectionString],
    { stdio: "inherit", env: connection.env },
  );
  if (result.error) {
    throw new Error("pg_dump could not start. Install PostgreSQL client tools (for example, brew install libpq).", {
      cause: result.error,
    });
  }
  if (result.status !== 0) throw new Error(`pg_dump failed with exit status ${result.status ?? "unknown"}.`);

  const digest = await sha256(outputPath);
  const manifest = {
    createdAt: new Date().toISOString(),
    database: new URL(databaseUrl).pathname.slice(1),
    databaseHost: new URL(databaseUrl).hostname,
    dump: path.relative(process.cwd(), outputPath),
    sha256: digest,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(`Backup created: ${outputPath}`);
  console.log(`SHA-256: ${digest}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error("Multi-tenant backup failed:", error);
  process.exitCode = 1;
});
