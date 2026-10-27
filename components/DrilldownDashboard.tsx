"use client";

import React, { useState, useEffect } from "react";
import type { PremiseItem } from "@/lib/types";
import { DEMO_PREMISES } from "@/lib/types";
import { PremiseSelector } from "./PremiseSelector";
import { ConsumptionChart, ChartDatum } from "./ConsumptionChart";
import { getTariffForVoltage, calculateCost, VOLTAGE_TARIFFS } from "@/lib/tariffs";
import {
  ChevronRight,
  Zap,
  Leaf,
  Activity,
  Layers,
  Calendar,
  RotateCcw,
  DollarSign,
  TrendingDown,
  LineChart,
  BarChart2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";

type DrillLevel = "yearly" | "monthly" | "daily" | "halfhourly";

interface DrilldownDashboardProps {
  initialPremises?: PremiseItem[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function DrilldownDashboard({ initialPremises = DEMO_PREMISES }: DrilldownDashboardProps) {
  const [premises] = useState<PremiseItem[]>(initialPremises);
  const [selectedPremise, setSelectedPremise] = useState<PremiseItem>(initialPremises[0]);

  // Drilldown hierarchy state
  const [level, setLevel] = useState<DrillLevel>("yearly");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // C-Level Executive Metric Mode Toggle: Energy (kWh) vs Financial Cost ($ SGD)
  const [metricMode, setMetricMode] = useState<"kwh" | "cost">("kwh");

  // Chart Presentation: Spline Curve vs Bars (active for halfhourly)
  const [chartType, setChartType] = useState<"curve" | "bar">("curve");

  // Raw data and mapped chart data
  const [rawData, setRawData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<ChartDatum[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Voltage Tariff Structure for this premise (HTL, HT, or LT)
  const tariff = getTariffForVoltage(selectedPremise.voltageType);

  // Fetch chart data on state change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        let url = `/api/consumption?premiseId=${encodeURIComponent(selectedPremise.id)}&type=${level}`;

        if (level === "monthly" && selectedYear) {
          url += `&year=${selectedYear}`;
        } else if (level === "daily" && selectedYear && selectedMonth) {
          url += `&year=${selectedYear}&month=${selectedMonth}`;
        } else if (level === "halfhourly" && selectedYear && selectedMonth && selectedDay) {
          url += `&year=${selectedYear}&month=${selectedMonth}&day=${selectedDay}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (!isMounted) return;
        setRawData(data);
      } catch (err) {
        console.error("Failed to fetch consumption data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [selectedPremise, level, selectedYear, selectedMonth, selectedDay]);

  // Transform rawData into ChartDatum when rawData, metricMode, or tariff changes
  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData([]);
      return;
    }

    const isCost = metricMode === "cost";
    let mapped: ChartDatum[] = [];

    if (level === "yearly") {
      mapped = rawData.map((d: any) => {
        const costInfo = calculateCost(d.totalKwh, d.peakKwh, d.offPeakKwh, tariff);
        return {
          label: String(d.year),
          total: isCost ? costInfo.totalCost : d.totalKwh,
          peak: isCost ? costInfo.peakCost : d.peakKwh,
          offPeak: isCost ? costInfo.offPeakCost : d.offPeakKwh,
          cost: costInfo.totalCost,
          peakCost: costInfo.peakCost,
          offPeakCost: costInfo.offPeakCost,
          rawPayload: { ...d, costInfo },
        };
      });
    } else if (level === "monthly") {
      mapped = rawData.map((d: any) => {
        const costInfo = calculateCost(d.totalKwh, d.peakKwh, d.offPeakKwh, tariff);
        return {
          label: d.monthName,
          subLabel: `M${d.month}`,
          total: isCost ? costInfo.totalCost : d.totalKwh,
          peak: isCost ? costInfo.peakCost : d.peakKwh,
          offPeak: isCost ? costInfo.offPeakCost : d.offPeakKwh,
          cost: costInfo.totalCost,
          peakCost: costInfo.peakCost,
          offPeakCost: costInfo.offPeakCost,
          rawPayload: { ...d, costInfo },
        };
      });
    } else if (level === "daily") {
      mapped = rawData.map((d: any) => {
        const costInfo = calculateCost(d.totalKwh, d.peakKwh, d.offPeakKwh, tariff);
        return {
          label: String(d.day),
          subLabel: d.dayOfWeek,
          total: isCost ? costInfo.totalCost : d.totalKwh,
          peak: isCost ? costInfo.peakCost : d.peakKwh,
          offPeak: isCost ? costInfo.offPeakCost : d.offPeakKwh,
          cost: costInfo.totalCost,
          peakCost: costInfo.peakCost,
          offPeakCost: costInfo.offPeakCost,
          rawPayload: { ...d, costInfo },
        };
      });
    } else if (level === "halfhourly") {
      mapped = rawData.map((d: any) => {
        const kwh = typeof d.kwh === "number" && Number.isFinite(d.kwh) ? d.kwh : 0;
        const isPeak = Boolean(d.isPeak);
        const rate = isPeak ? tariff.peakRate : tariff.offPeakRate;
        const intervalCost = kwh * (rate + tariff.networkRate);
        return {
          label: d.time || "00:00",
          total: isCost ? intervalCost : kwh,
          peak: isPeak ? (isCost ? intervalCost : kwh) : 0,
          offPeak: !isPeak ? (isCost ? intervalCost : kwh) : 0,
          kvarh: d.kvarh ?? 0,
          cost: intervalCost,
          rawPayload: { ...d, kwh, isPeak, cost: intervalCost, rate },
        };
      });
    }

    setChartData(mapped);
  }, [rawData, metricMode, level, tariff]);

  // Handle drilldown click (bar or point selection)
  const handleBarSelect = (item: ChartDatum) => {
    if (level === "yearly") {
      const year = parseInt(item.label, 10);
      setSelectedYear(year);
      setLevel("monthly");
    } else if (level === "monthly") {
      const monthNum = item.rawPayload?.month;
      setSelectedMonth(monthNum);
      setLevel("daily");
    } else if (level === "daily") {
      const dayNum = item.rawPayload?.day;
      setSelectedDay(dayNum);
      setLevel("halfhourly");
    }
  };

  // Breadcrumb & Control navigation click handlers
  const navigateToYearly = () => {
    setLevel("yearly");
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedDay(null);
  };

  const navigateToMonthly = () => {
    setLevel("monthly");
    setSelectedMonth(null);
    setSelectedDay(null);
  };

  const navigateToDaily = () => {
    setLevel("daily");
    setSelectedDay(null);
  };

  // Handle direct level button clicks with validation checks
  const handleLevelSwitch = (targetLevel: DrillLevel) => {
    if (targetLevel === "yearly") {
      navigateToYearly();
    } else if (targetLevel === "monthly") {
      if (!selectedYear && chartData.length > 0) {
        const defaultYear = parseInt(chartData[0].label, 10) || 2024;
        setSelectedYear(defaultYear);
      }
      setLevel("monthly");
    } else if (targetLevel === "daily") {
      if (!selectedYear && chartData.length > 0) {
        setSelectedYear(parseInt(chartData[0].label, 10) || 2024);
      }
      if (!selectedMonth) {
        setSelectedMonth(8); // Default to August
      }
      setLevel("daily");
    } else if (targetLevel === "halfhourly") {
      if (!selectedYear && chartData.length > 0) {
        setSelectedYear(parseInt(chartData[0].label, 10) || 2024);
      }
      if (!selectedMonth) {
        setSelectedMonth(8);
      }
      if (!selectedDay) {
        setSelectedDay(1);
      }
      setLevel("halfhourly");
    }
  };

  // Calculate high-level summary KPIs
  // Aggregated totals in kWh (regardless of current view metric)
  const totalKwhSum = rawData.reduce((acc, d) => acc + (d.totalKwh ?? d.kwh ?? 0), 0);
  const peakKwhSum = rawData.reduce((acc, d) => {
    if (d.peakKwh !== undefined) return acc + d.peakKwh;
    if (d.isPeak) return acc + (d.kwh ?? 0);
    return acc;
  }, 0);
  const offPeakKwhSum = Math.max(0, totalKwhSum - peakKwhSum);
  const peakPercentage = totalKwhSum > 0 ? Math.round((peakKwhSum / totalKwhSum) * 100) : 0;
  const estimatedCarbonKg = Math.round(totalKwhSum * 0.4085);

  // Financial Cost Metrics calculated using active voltage tariff (HTL, HT, or LT)
  const costCalculation = calculateCost(totalKwhSum, peakKwhSum, offPeakKwhSum, tariff);

  const getLevelTitle = () => {
    switch (level) {
      case "yearly":
        return "Annual Consumption & Spend (Year-on-Year)";
      case "monthly":
        return `Monthly Consumption & Cost for ${selectedYear ?? "Selected Year"}`;
      case "daily":
        return `Daily Consumption & Cost for ${MONTH_NAMES[(selectedMonth || 1) - 1]} ${selectedYear ?? ""}`;
      case "halfhourly":
        return `Half-Hourly Load Profile (30-min Intervals) - Day ${selectedDay ?? 1}, ${MONTH_NAMES[(selectedMonth || 1) - 1]} ${selectedYear ?? ""}`;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Premise Selector */}
      <PremiseSelector
        premises={premises}
        selectedPremise={selectedPremise}
        onSelect={(p) => {
          setSelectedPremise(p);
          navigateToYearly();
        }}
      />

      {/* Voltage Tier & Active Tariff Schedule Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/70 px-2 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                {tariff.name}
              </span>
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono">
                {tariff.nominalVoltage}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {tariff.voltageDescription}
            </p>
          </div>
        </div>

        {/* Tariff Rate Breakdown Pills */}
        <div className="flex items-center gap-1 flex-wrap text-[11px]">
          <div className="rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 text-amber-800 dark:text-amber-300">
            <span className="font-medium text-amber-600 dark:text-amber-400">Peak (07:00–23:00): </span>
            <span className="font-bold font-mono">${tariff.peakRate.toFixed(4)}/kWh</span>
          </div>
          <div className="rounded-lg bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 px-2.5 py-1 text-sky-800 dark:text-sky-300">
            <span className="font-medium text-sky-600 dark:text-sky-400">Off-Peak (23:00–07:00): </span>
            <span className="font-bold font-mono">${tariff.offPeakRate.toFixed(4)}/kWh</span>
          </div>
          <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-zinc-600 dark:text-zinc-300">
            <span className="text-zinc-400">Network/Misc: </span>
            <span className="font-bold font-mono">${tariff.networkRate.toFixed(4)}/kWh</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-zinc-400">Drilldown:</span>

          <button
            onClick={navigateToYearly}
            className={`font-semibold transition-colors hover:text-emerald-500 ${level === "yearly" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"
              }`}
          >
            {selectedPremise.name}
          </button>

          {selectedYear && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              <button
                onClick={navigateToMonthly}
                className={`font-medium transition-colors hover:text-emerald-500 ${level === "monthly" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-zinc-700 dark:text-zinc-300"
                  }`}
              >
                Year {selectedYear}
              </button>
            </>
          )}

          {selectedMonth && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              <button
                onClick={navigateToDaily}
                className={`font-medium transition-colors hover:text-emerald-500 ${level === "daily" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-zinc-700 dark:text-zinc-300"
                  }`}
              >
                {MONTH_NAMES[selectedMonth - 1]}
              </button>
            </>
          )}

          {selectedDay && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Day {selectedDay} (Half-Hourly)
              </span>
            </>
          )}
        </div>

        {level !== "yearly" && (
          <button
            onClick={navigateToYearly}
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset to Annual</span>
          </button>
        )}
      </div>
       */}

      {/* C-Level Executive KPI Stat Cards (Switches dynamically between kWh and $ Cost) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metricMode === "cost" ? (
          /* FINANCIAL COST VIEW CARDS */
          <>
            {/* Total Spend ($ SGD) */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Total Energy Spend</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                ${costCalculation.totalCost > 1000000
                  ? `${(costCalculation.totalCost / 1000000).toFixed(2)}M`
                  : costCalculation.totalCost > 1000
                    ? `${(costCalculation.totalCost / 1000).toFixed(1)}k`
                    : `${Math.round(costCalculation.totalCost).toLocaleString()}`} <span className="text-xs font-normal text-zinc-400">SGD</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                Energy: ${Math.round(costCalculation.peakCost + costCalculation.offPeakCost).toLocaleString()} • Net: ${Math.round(costCalculation.networkCost).toLocaleString()}
              </div>
            </div>

            {/* Peak Period Spend */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Peak Period Spend</span>
                <Activity className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-500">
                ${costCalculation.peakCost > 1000000
                  ? `${(costCalculation.peakCost / 1000000).toFixed(2)}M`
                  : costCalculation.peakCost > 1000
                    ? `${(costCalculation.peakCost / 1000).toFixed(1)}k`
                    : `${Math.round(costCalculation.peakCost).toLocaleString()}`} <span className="text-xs font-normal text-zinc-400">({costCalculation.totalCost > 0 ? Math.round((costCalculation.peakCost / costCalculation.totalCost) * 100) : 0}%)</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                Off-Peak: ${Math.round(costCalculation.offPeakCost).toLocaleString()} ({costCalculation.totalCost > 0 ? Math.round((costCalculation.offPeakCost / costCalculation.totalCost) * 100) : 0}%)
              </div>
            </div>

            {/* Effective Blended Tariff */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Effective Tariff</span>
                <SlidersHorizontal className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-sky-500">
                ${costCalculation.effectiveRate.toFixed(4)} <span className="text-xs font-normal text-zinc-400">/ kWh</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                vs SP Standard: ${tariff.spBenchmarkRate.toFixed(4)}/kWh
              </div>
            </div>

            {/* Peak Shifting Savings Potential */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>10% Peak Shave Savings</span>
                <TrendingDown className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                ${costCalculation.costAvoidancePotential > 1000
                  ? `${(costCalculation.costAvoidancePotential / 1000).toFixed(1)}k`
                  : Math.round(costCalculation.costAvoidancePotential).toLocaleString()} <span className="text-xs font-normal text-zinc-400">SGD</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                Shifting 10% peak chiller load to off-peak
              </div>
            </div>
          </>
        ) : (
          /* PHYSICAL CONSUMPTION (KWH) VIEW CARDS */
          <>
            {/* Total Energy */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Total Consumption</span>
                <Zap className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {totalKwhSum > 1000000
                  ? `${(totalKwhSum / 1000000).toFixed(2)} GWh`
                  : totalKwhSum > 1000
                    ? `${(totalKwhSum / 1000).toFixed(1)} MWh`
                    : `${Math.round(totalKwhSum).toLocaleString()} kWh`}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {level === "yearly" ? "Total historical" : `In selected ${level}`}
              </div>
            </div>

            {/* Peak Ratio */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Peak Ratio</span>
                <Activity className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-500">
                {peakPercentage}%
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {Math.round(peakKwhSum).toLocaleString()} kWh (Peak)
              </div>
            </div>

            {/* Off-Peak */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Off-Peak Usage</span>
                <Layers className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-sky-500">
                {100 - peakPercentage}%
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {Math.round(offPeakKwhSum).toLocaleString()} kWh (Off-Peak)
              </div>
            </div>

            {/* Estimated Carbon */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Carbon Footprint</span>
                <Leaf className="h-4 w-4 text-teal-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
                {estimatedCarbonKg > 1000
                  ? `${(estimatedCarbonKg / 1000).toFixed(1)} t CO₂e`
                  : `${estimatedCarbonKg} kg CO₂e`}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                Grid factor: 0.4085 kg/kWh
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Chart Card (Drilldown and Navigation handled inside ConsumptionChart) */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 backdrop-blur-md flex h-[420px] items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-xs text-zinc-400">Loading consumption intervals...</span>
          </div>
        </div>
      ) : (
        <ConsumptionChart
          data={chartData}
          level={level}
          onLevelChange={handleLevelSwitch}
          onSelect={handleBarSelect}
          onReset={navigateToYearly}
          onNavigateToYearly={navigateToYearly}
          onNavigateToMonthly={navigateToMonthly}
          onNavigateToDaily={navigateToDaily}
          premiseName={selectedPremise.name}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          metricMode={metricMode}
          onMetricModeChange={setMetricMode}
          chartType={chartType}
          onChartTypeChange={setChartType}
          tariff={tariff}
          voltageType={tariff.code}
          unit={metricMode === "cost" ? "$" : "kWh"}
        />
      )}
    </div>
  );
}