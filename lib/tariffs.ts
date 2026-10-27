export interface TariffStructure {
  code: "HTL" | "HT" | "LT";
  name: string;
  voltageDescription: string;
  nominalVoltage: string;
  peakRate: number; // SGD $/kWh (07:00 - 23:00)
  offPeakRate: number; // SGD $/kWh (23:00 - 07:00)
  networkRate: number; // SGD $/kWh (UOS, CC, Carbon Tax, Metering)
  spBenchmarkRate: number; // SP standard benchmark rate $/kWh
}

/**
 * Standard Singapore Commercial Energy Tariffs based on SP Services & EMA structure
 * Used in ARGO energy accounting.
 */
export const VOLTAGE_TARIFFS: Record<"HTL" | "HT" | "LT", TariffStructure> = {
  HTL: {
    code: "HTL",
    name: "High Tension Large (HTL)",
    voltageDescription: "Bulk transmission network (66 kV / 230 kV)",
    nominalVoltage: "66 kV",
    peakRate: 0.2052, // SGD $/kWh
    offPeakRate: 0.1418, // SGD $/kWh
    networkRate: 0.0384, // SGD $/kWh (UOS + Capacity + Carbon Tax)
    spBenchmarkRate: 0.2985,
  },
  HT: {
    code: "HT",
    name: "High Tension (HT)",
    voltageDescription: "Standard commercial intake (22 kV / 6.6 kV)",
    nominalVoltage: "22 kV",
    peakRate: 0.2284,
    offPeakRate: 0.1582,
    networkRate: 0.0436,
    spBenchmarkRate: 0.3120,
  },
  LT: {
    code: "LT",
    name: "Low Tension (LT)",
    voltageDescription: "Low voltage commercial / retail (400 V / 230 V)",
    nominalVoltage: "400 V",
    peakRate: 0.2685,
    offPeakRate: 0.1984,
    networkRate: 0.0522,
    spBenchmarkRate: 0.3392,
  },
};

/**
 * Resolves the tariff structure based on the premise's voltage classification.
 */
export function getTariffForVoltage(voltageType?: string | null): TariffStructure {
  if (!voltageType) return VOLTAGE_TARIFFS.HT;
  const upper = voltageType.toUpperCase();
  if (upper.includes("HTL")) return VOLTAGE_TARIFFS.HTL;
  if (upper.includes("LT")) return VOLTAGE_TARIFFS.LT;
  if (upper.includes("HT")) return VOLTAGE_TARIFFS.HT;
  return VOLTAGE_TARIFFS.HT;
}

export interface CalculatedCost {
  totalCost: number;
  peakCost: number;
  offPeakCost: number;
  networkCost: number;
  effectiveRate: number; // Blended $/kWh
  costAvoidancePotential: number; // Estimated savings from 10% peak shaving
}

/**
 * Computes energy costs based on kWh and voltage tariff schedule.
 */
export function calculateCost(
  totalKwh: number,
  peakKwh: number,
  offPeakKwh: number,
  tariff: TariffStructure
): CalculatedCost {
  const peakCost = peakKwh * tariff.peakRate;
  const offPeakCost = offPeakKwh * tariff.offPeakRate;
  const networkCost = totalKwh * tariff.networkRate;
  const totalCost = peakCost + offPeakCost + networkCost;
  const effectiveRate = totalKwh > 0 ? totalCost / totalKwh : tariff.peakRate;

  // Potential financial savings if 10% of peak load is shifted to off-peak (e.g. pre-cooling, battery storage)
  const shiftableKwh = peakKwh * 0.10;
  const costAvoidancePotential = shiftableKwh * (tariff.peakRate - tariff.offPeakRate);

  return {
    totalCost,
    peakCost,
    offPeakCost,
    networkCost,
    effectiveRate,
    costAvoidancePotential,
  };
}
