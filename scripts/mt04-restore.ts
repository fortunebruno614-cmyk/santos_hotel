import "./load-env";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
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

function sameDatabase(left: URL, right: URL): boolean {
  return left.hostname === right.hostname &&
    left.port === right.port &&
    left.pathname === right.pathname;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) =>
    argument !== "--apply" && !argument.startsWith("--dump=") && !argument.startsWith("--confirm-target="),
  )) {
    throw new Error("Usage: npm run mt:restore -- --dump=path/to/backup.dump [--apply --confirm-target=<local_db_name_restore>]");
  }
  const dumpPathArg = option("dump");
  if (!dumpPathArg) throw new Error("--dump=path/to/backup.dump is required.");
  const dumpPath = path.resolve(process.cwd(), dumpPathArg);
  if (!existsSync(dumpPath)) throw new Error(`Backup file does not exist: ${dumpPath}`);

  const listResult = spawnSync("pg_restore", ["--list", dumpPath], { encoding: "utf8" });
  if (listResult.error) {
    throw new Error("pg_restore could not start. Install PostgreSQL client tools (for example, brew install libpq).", {
      cause: listResult.error,
    });
  }
  if (listResult.status !== 0) throw new Error("Backup is not a readable PostgreSQL custom-format dump.");

  const digest = await sha256(dumpPath);
  console.log(`Backup verified: ${path.relative(process.cwd(), dumpPath)}`);
  console.log(`SHA-256: ${digest}`);
  if (!args.includes("--apply")) {
    console.log("Dry run only. Restore requires --apply and an explicit local restore target.");
    return;
  }

  const currentUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.MT_RESTORE_DATABASE_URL;
  if (!currentUrl || !targetUrl) {
    throw new Error("Set DATABASE_URL and MT_RESTORE_DATABASE_URL before restoring.");
  }
  const source = new URL(currentUrl);
  const target = new URL(targetUrl);
  const targetName = decodeURIComponent(target.pathname.slice(1));
  if (sameDatabase(source, target)) throw new Error("Restore target must not be the current DATABASE_URL.");
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname)) {
    throw new Error("Restore is restricted to a loopback host; production or remote targets are refused.");
  }
  if (!/(^|[_-])restore([_-]|$)/i.test(targetName)) {
    throw new Error("Restore database name must contain a distinct 'restore' marker.");
  }
  if (option("confirm-target") !== targetName) {
    throw new Error(`Repeat the exact target database name with --confirm-target=${targetName}.`);
  }

  const connection = postgresConnection(targetUrl);
  const result = spawnSync(
    "pg_restore",
    ["--no-password", "--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", connection.connectionString, dumpPath],
    { stdio: "inherit", env: connection.env },
  );
  if (result.error) {
    throw new Error("pg_restore could not start.", { cause: result.error });
  }
  if (result.status !== 0) throw new Error(`pg_restore failed with exit status ${result.status ?? "unknown"}.`);
  console.log(`Restore completed to local scratch database '${targetName}'.`);
}

main().catch((error) => {
  console.error("Multi-tenant restore failed:", error);
  process.exitCode = 1;
});
