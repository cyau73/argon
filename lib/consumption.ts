import { prisma } from "./prisma";
export type { PremiseItem, YearlyData, MonthlyData, DailyData, HalfHourlyData } from "./types";
export { DEMO_PREMISES } from "./types";
import type { PremiseItem, YearlyData, MonthlyData, DailyData, HalfHourlyData } from "./types";
import { DEMO_PREMISES } from "./types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Helper to generate realistic deterministic energy profiles based on legacy patterns
function generateMockHalfHourly(dateSeed: number): HalfHourlyData[] {
  const result: HalfHourlyData[] = [];
  for (let i = 0; i < 48; i++) {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    const time = `${String(hour).padStart(2, "0")}:${minute}`;
    const isPeak = hour >= 7 && hour < 23;

    // Bell curve during retail/business hours (10am to 10pm) + baseline night chiller load
    let baseLoad = 350; // chiller & emergency systems
    if (hour >= 10 && hour <= 21) {
      const peakFactor = Math.sin(((hour - 10) / 11) * Math.PI);
      baseLoad += 700 * peakFactor + ((dateSeed * 17 + i * 3) % 80);
    } else if (hour >= 7 && hour < 10) {
      baseLoad += 280; // opening preparation
    } else if (hour > 21 && hour < 23) {
      baseLoad += 180; // closing
    }

    const jitter = ((dateSeed + i * 7) % 35) - 17;
    const kwh = Math.round((baseLoad + jitter) * 10) / 10;
    const kvarh = Math.round(kwh * 0.28 * 10) / 10;

    result.push({
      time,
      kwh,
      kvarh,
      isPeak,
    });
  }
  return result;
}

export async function fetchPremises(): Promise<PremiseItem[]> {
  try {
    const dbPremises = await prisma.premise.findMany({
      include: { portfolio: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    if (dbPremises.length > 0) {
      return dbPremises.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        portfolio: p.portfolio?.name || p.portfolio?.code || "Commercial Portfolio",
        voltageType: p.voltageType || "HTL",
        region: p.region || "Central",
        area: p.area || "City",
        greenMarkRating: p.greenMarkRating || "Certified",
        address: p.address || "Singapore",
      }));
    }
  } catch {
    // Database connection or table not yet initialized, fall through to demo items
  }

  return DEMO_PREMISES;
}

export async function fetchYearlyDrilldown(premiseId: string): Promise<YearlyData[]> {
  try {
    // Check if Postgres database has readings
    const readingsCount = await prisma.premiseReading.count({
      where: { premiseId },
    });

    if (readingsCount > 0) {
      // Postgres aggregation query
      const rows = await prisma.$queryRaw<
        Array<{
          year: number;
          total_kwh: number;
          peak_kwh: number;
          offpeak_kwh: number;
          max_kw: number;
        }>
      >`
        SELECT 
          EXTRACT(YEAR FROM "timestamp")::int AS year,
          ROUND(SUM("kwh")::numeric, 2)::float AS total_kwh,
          ROUND(SUM(CASE WHEN "isPeak" THEN "kwh" ELSE 0 END)::numeric, 2)::float AS peak_kwh,
          ROUND(SUM(CASE WHEN NOT "isPeak" THEN "kwh" ELSE 0 END)::numeric, 2)::float AS offpeak_kwh,
          ROUND((MAX("kwh") * 2)::numeric, 2)::float AS max_kw
        FROM "premise_readings"
        WHERE "premiseId" = ${premiseId}
        GROUP BY EXTRACT(YEAR FROM "timestamp")
        ORDER BY year ASC
      `;

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          year: r.year,
          totalKwh: r.total_kwh,
          peakKwh: r.peak_kwh,
          offPeakKwh: r.offpeak_kwh,
          maxKw: r.max_kw,
        }));
      }
    }
  } catch {
    // Fall back to demo data
  }

  // Realistic mock yearly data matching the 2017-2020 dataset in backup
  return [
    { year: 2017, totalKwh: 12450200, peakKwh: 8964144, offPeakKwh: 3486056, maxKw: 2450 },
    { year: 2018, totalKwh: 12890500, peakKwh: 9281160, offPeakKwh: 3609340, maxKw: 2510 },
    { year: 2019, totalKwh: 12150800, peakKwh: 8748576, offPeakKwh: 3402224, maxKw: 2380 },
    { year: 2020, totalKwh: 10420600, peakKwh: 7502832, offPeakKwh: 2917768, maxKw: 2120 },
  ];
}

export async function fetchMonthlyDrilldown(premiseId: string, year: number): Promise<MonthlyData[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        month: number;
        total_kwh: number;
        peak_kwh: number;
        offpeak_kwh: number;
      }>
    >`
      SELECT 
        EXTRACT(MONTH FROM "timestamp")::int AS month,
        ROUND(SUM("kwh")::numeric, 2)::float AS total_kwh,
        ROUND(SUM(CASE WHEN "isPeak" THEN "kwh" ELSE 0 END)::numeric, 2)::float AS peak_kwh,
        ROUND(SUM(CASE WHEN NOT "isPeak" THEN "kwh" ELSE 0 END)::numeric, 2)::float AS offpeak_kwh
      FROM "premise_readings"
      WHERE "premiseId" = ${premiseId}
        AND EXTRACT(YEAR FROM "timestamp") = ${year}
      GROUP BY EXTRACT(MONTH FROM "timestamp")
      ORDER BY month ASC
    `;

    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        month: r.month,
        monthName: MONTH_NAMES[r.month - 1] || `M${r.month}`,
        totalKwh: r.total_kwh,
        peakKwh: r.peak_kwh,
        offPeakKwh: r.offpeak_kwh,
      }));
    }
  } catch {
    // Fall back to demo data
  }

  // Seasonality factors for Singapore retail mall
  const seasonality = [0.98, 0.92, 1.02, 1.05, 1.08, 1.03, 1.04, 1.06, 1.01, 1.02, 1.07, 1.12];
  const baseMonthly = 950000;

  return seasonality.map((factor, idx) => {
    const totalKwh = Math.round(baseMonthly * factor);
    const peakKwh = Math.round(totalKwh * 0.72);
    const offPeakKwh = totalKwh - peakKwh;
    return {
      month: idx + 1,
      monthName: MONTH_NAMES[idx],
      totalKwh,
      peakKwh,
      offPeakKwh,
    };
  });
}

export async function fetchDailyDrilldown(
  premiseId: string,
  year: number,
  month: number
): Promise<DailyData[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        day: number;
        total_kwh: number;
        peak_kwh: number;
        offpeak_kwh: number;
      }>
    >`
      SELECT 
        EXTRACT(DAY FROM "timestamp")::int AS day,
        ROUND(SUM("kwh")::numeric, 2)::float AS total_kwh,
        ROUND(SUM(CASE WHEN "isPeak" THEN "kwh" ELSE 0 END)::numeric, 2)::float AS peak_kwh,
        ROUND(SUM(CASE WHEN NOT "isPeak" THEN "kwh" ELSE 0 END)::numeric, 2)::float AS offpeak_kwh
      FROM "premise_readings"
      WHERE "premiseId" = ${premiseId}
        AND EXTRACT(YEAR FROM "timestamp") = ${year}
        AND EXTRACT(MONTH FROM "timestamp") = ${month}
      GROUP BY EXTRACT(DAY FROM "timestamp")
      ORDER BY day ASC
    `;

    if (rows && rows.length > 0) {
      return rows.map((r) => {
        const d = new Date(year, month - 1, r.day);
        const dayOfWeek = DAY_NAMES[d.getDay()];
        return {
          day: r.day,
          dateStr: `${year}-${String(month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`,
          dayOfWeek,
          totalKwh: r.total_kwh,
          peakKwh: r.peak_kwh,
          offPeakKwh: r.offpeak_kwh,
        };
      });
    }
  } catch {
    // Fall back to demo data
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const result: DailyData[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const baseDaily = isWeekend ? 34200 : 31500;
    const variance = ((d * 137) % 2500) - 1250;
    const totalKwh = baseDaily + variance;
    const peakKwh = Math.round(totalKwh * 0.73);
    const offPeakKwh = totalKwh - peakKwh;

    result.push({
      day: d,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      dayOfWeek: DAY_NAMES[dateObj.getDay()],
      totalKwh,
      peakKwh,
      offPeakKwh,
    });
  }

  return result;
}

export async function fetchHalfHourlyDrilldown(
  premiseId: string,
  year: number,
  month: number,
  day: number
): Promise<HalfHourlyData[]> {
  try {
    const monthPadded = String(month).padStart(2, "0");
    const dayPadded = String(day).padStart(2, "0");
    // Singapore is UTC+08:00
    const startDate = new Date(`${year}-${monthPadded}-${dayPadded}T00:00:00+08:00`);
    const endDate = new Date(`${year}-${monthPadded}-${dayPadded}T23:59:59+08:00`);

    const readings = await prisma.premiseReading.findMany({
      where: {
        premiseId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: "asc" },
      take: 48,
    });

    if (readings.length > 0) {
      const timeFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Singapore",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return readings.map((r) => {
        const time = timeFormatter.format(new Date(r.timestamp));
        return {
          time,
          kwh: Number(r.kwh),
          kvarh: r.kvarh ? Number(r.kvarh) : 0,
          isPeak: r.isPeak,
        };
      });
    }
  } catch {
    // Fall back to demo data
  }

  return generateMockHalfHourly(year * 10000 + month * 100 + day);
}
