import "./load-env";
import { prisma } from "../src/lib/prisma";

async function main() {
  const hotels = await prisma.hotel.count();
  console.log(`Database connection OK. Hotel rows: ${hotels}`);
}

main()
  .catch((error) => {
    console.error("Database smoke test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
