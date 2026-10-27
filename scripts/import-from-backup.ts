/**
 * ETL Migration Script
 * Imports premises and consumption readings from backup-2020-10-21.sql into PostgreSQL via Prisma.
 *
 * Usage:
 *   npx tsx scripts/import-from-backup.ts [target_premise_name]
 * Example:
 *   npx tsx scripts/import-from-backup.ts "313@Somerset"
 */

import fs from "fs";
import readline from "readline";
import "dotenv/config";
import { PrismaClient } from '@prisma/client'; // Adjust path if your client is generated elsewhere
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Setup the pool and adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Pass the adapter to the PrismaClient constructor
const prisma = new PrismaClient({ adapter });

const BACKUP_PATH = "/Volumes/Music/BACKUPS/CW/mysqldump/backup/backup-2020-10-21.sql";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

async function main() {
  const targetPremise = process.argv[2] || "313@Somerset";
  console.log(`Starting ETL migration for premise: "${targetPremise}"`);
  console.log(`Reading SQL backup from: ${BACKUP_PATH}`);

  if (!fs.existsSync(BACKUP_PATH)) {
    console.error(`Backup file not found at ${BACKUP_PATH}`);
    process.exit(1);
  }

  // Ensure portfolio & premise record exist
  let premise = await prisma.premise.findFirst({
    where: { name: targetPremise },
  });

  if (!premise) {
    const defaultPortfolio = await prisma.portfolio.upsert({
      where: { code: "DEMO" },
      update: {},
      create: { code: "DEMO", name: "Commercial & Retail Portfolio" },
    });

    premise = await prisma.premise.create({
      data: {
        name: targetPremise,
        slug: slugify(targetPremise),
        portfolioId: defaultPortfolio.id,
        voltageType: "HTL",
        country: "Singapore",
        countryCode: "SG",
        region: "Central",
        area: "Orchard",
        masterGroup: "Retail Mall",
        subGroup: "Retail Mall",
        greenMarkRating: "Platinum",
        address: "313 Orchard Road, Singapore 238895",
        operationHours: "10:00 AM - 10:00 PM",
      },
    });
    console.log(`Created Premise: ${premise.name} (${premise.id})`);
  }

  const fileStream = fs.createReadStream(BACKUP_PATH, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let inHalfhourTable = false;
  let totalImported = 0;
  const batchSize = 1000;
  let batch: Array<{
    premiseId: string;
    timestamp: Date;
    kwh: number;
    isPeak: boolean;
  }> = [];

  for await (const line of rl) {
    if (line.includes("INSERT INTO `halfhour` VALUES")) {
      inHalfhourTable = true;
    } else if (inHalfhourTable && line.startsWith("INSERT INTO `") && !line.includes("`halfhour`")) {
      inHalfhourTable = false;
    }

    if (!inHalfhourTable) continue;
    if (!line.includes(`'${targetPremise}'`)) continue;

    // Parse tuples in the line: ('Building','Read_date','Hour',Day01..Day31)
    // Regex matching each tuple
    const tupleRegex = /\('([^']+)',\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})',\s*'([0-9]{2}:[0-9]{2}:[0-9]{2})',([^)]+)\)/g;
    let match;

    while ((match = tupleRegex.exec(line)) !== null) {
      const building = match[1];
      if (building !== targetPremise) continue;

      const readDateStr = match[2]; // e.g. "2020-08-01"
      const hourStr = match[3]; // e.g. "12:30:00"
      const dayValues = match[4].split(",").map((v) => parseFloat(v.trim()));

      const [yearStr, monthStr] = readDateStr.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const daysInMonth = getDaysInMonth(year, month);

      const hourNum = parseInt(hourStr.split(":")[0], 10);
      const isPeak = hourNum >= 7 && hourNum < 23;

      for (let day = 1; day <= daysInMonth; day++) {
        const val = dayValues[day - 1];
        if (val === undefined || isNaN(val) || val <= 0) continue;

        const dayPadded = String(day).padStart(2, "0");
        const monthPadded = String(month).padStart(2, "0");
        // SGT (+08:00)
        const isoString = `${year}-${monthPadded}-${dayPadded}T${hourStr}+08:00`;
        const timestamp = new Date(isoString);

        batch.push({
          premiseId: premise.id,
          timestamp,
          kwh: val,
          isPeak,
        });

        if (batch.length >= batchSize) {
          await prisma.premiseReading.createMany({
            data: batch,
            skipDuplicates: true,
          });
          totalImported += batch.length;
          process.stdout.write(`\rImported ${totalImported} intervals for ${targetPremise}...`);
          batch = [];
        }
      }
    }
  }

  if (batch.length > 0) {
    await prisma.premiseReading.createMany({
      data: batch,
      skipDuplicates: true,
    });
    totalImported += batch.length;
  }

  console.log(`\nETL Complete! Total imported half-hour readings: ${totalImported}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
