import { closePrisma, inspectMigration, printPreflight } from "./mt-migration";

async function main() {
  const report = await inspectMigration();
  printPreflight(report);
  if (!report.canBackfill) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Multi-tenant preflight failed:", error);
    process.exitCode = 1;
  })
  .finally(closePrisma);
