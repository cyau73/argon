export interface PremiseItem {
  id: string;
  slug: string;
  name: string;
  portfolio: string;
  voltageType: string;
  region: string;
  area: string;
  greenMarkRating: string;
  address: string;
}

export interface YearlyData {
  year: number;
  totalKwh: number;
  peakKwh: number;
  offPeakKwh: number;
  maxKw: number;
}

export interface MonthlyData {
  month: number;
  monthName: string;
  totalKwh: number;
  peakKwh: number;
  offPeakKwh: number;
}

export interface DailyData {
  day: number;
  dateStr: string;
  dayOfWeek: string;
  totalKwh: number;
  peakKwh: number;
  offPeakKwh: number;
}

export interface HalfHourlyData {
  time: string;
  kwh: number;
  kvarh: number;
  isPeak: boolean;
}

// Default Showcase Premises
export const DEMO_PREMISES: PremiseItem[] = [
  {
    id: "premise-313-somerset",
    slug: "313-somerset",
    name: "313@Somerset",
    portfolio: "Lendlease",
    voltageType: "HTL (High Tension Large)",
    region: "Central",
    area: "Orchard",
    greenMarkRating: "Platinum",
    address: "313 Orchard Road, Singapore 238895",
  },
  {
    id: "premise-sembawang",
    slug: "sembawang-shopping-centre",
    name: "Sembawang Shopping Centre",
    portfolio: "CWServices",
    voltageType: "HT (High Tension)",
    region: "North",
    area: "Sembawang",
    greenMarkRating: "Gold Plus",
    address: "604 Sembawang Road, Singapore 758459",
  },
  {
    id: "premise-west-mall",
    slug: "west-mall",
    name: "West Mall",
    portfolio: "Commercial REIT",
    voltageType: "HTL (High Tension Large)",
    region: "West",
    area: "Bukit Batok",
    greenMarkRating: "Gold",
    address: "1 Bukit Batok Central Link, Singapore 658713",
  },
  {
    id: "premise-science-park",
    slug: "1-science-park-drive",
    name: "1 Science Park Drive",
    portfolio: "PSB",
    voltageType: "HT (High Tension)",
    region: "South-West",
    area: "Queenstown",
    greenMarkRating: "Platinum",
    address: "1 Science Park Drive, Singapore 118221",
  },
  {
    id: "premise-clarke-quay",
    slug: "clarke-quay-central-retail",
    name: "Clarke Quay Central Retail",
    portfolio: "Far East Commercial",
    voltageType: "LT (Low Tension)",
    region: "Central",
    area: "Clarke Quay",
    greenMarkRating: "Gold",
    address: "6 Eu Tong Sen Street, Singapore 059817",
  },
];
