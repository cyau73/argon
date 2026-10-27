"use client";

import React, { useState } from "react";
import { LoadCurveChart } from "./LoadCurveChart";
import { TariffStructure, VOLTAGE_TARIFFS } from "@/lib/tariffs";
import { ChevronRight, Calendar, RotateCcw, Zap, DollarSign, LineChart, BarChart2 } from "lucide-react";

export interface ChartDatum {
  label: string;
  subLabel?: string;
  total: number;
  peak?: number;
  offPeak?: number;
  kvarh?: number;
  cost?: number;
  peakCost?: number;
  offPeakCost?: number;
  rawPayload?: any;
}

type DrillLevel = "yearly" | "monthly" | "daily" | "halfhourly";

interface ConsumptionChartProps {
  data: ChartDatum[];
  level: DrillLevel;
  onLevelChange: (level: DrillLevel) => void;
  onSelect: (item: ChartDatum, index: number) => void;
  onReset: () => void;
  onNavigateToYearly: () => void;
  onNavigateToMonthly: () => void;
  onNavigateToDaily: () => void;
  premiseName: string;
  selectedYear: number | null;
  selectedMonth: number | null;
  selectedDay: number | null;
  unit?: string;
  metricMode?: "kwh" | "cost";
  onMetricModeChange?: (mode: "kwh" | "cost") => void;
  chartType?: "curve" | "bar";
  onChartTypeChange?: (type: "curve" | "bar") => void;
  tariff?: TariffStructure;
  voltageType?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function ConsumptionChart({
  data,
  level,
  onLevelChange,
  onSelect,
  onReset,
  onNavigateToYearly,
  onNavigateToMonthly,
  onNavigateToDaily,
  premiseName,
  selectedYear,
  selectedMonth,
  selectedDay,
  unit = "kWh",
  metricMode = "kwh",
  onMetricModeChange,
  chartType = "curve",
  onChartTypeChange,
  tariff = VOLTAGE_TARIFFS.HT,
  voltageType = "HT",
}: ConsumptionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 backdrop-blur-md flex flex-col items-center justify-center min-h-[460px] text-sm text-zinc-400">
        No consumption data available for this range.
      </div>
    );
  }

  const isCost = metricMode === "cost";
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const chartHeight = 280;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 backdrop-blur-md flex flex-col gap-4 w-full select-none min-h-[460px]">

      {/* 1. Breadcrumb Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-zinc-400">Drilldown:</span>

          <button
            type="button"
            onClick={onNavigateToYearly}
            className={`font-semibold transition-colors hover:text-emerald-500 cursor-pointer ${level === "yearly" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"
              }`}
          >
            {premiseName}
          </button>

          {selectedYear && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              <button
                type="button"
                onClick={onNavigateToMonthly}
                className={`font-medium transition-colors hover:text-emerald-500 cursor-pointer ${level === "monthly" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-zinc-700 dark:text-zinc-300"
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
                type="button"
                onClick={onNavigateToDaily}
                className={`font-medium transition-colors hover:text-emerald-500 cursor-pointer ${level === "daily" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-zinc-700 dark:text-zinc-300"
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
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset to Annual</span>
          </button>
        )}
      </div>

      {/* 2. Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 p-2">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500" />
            <h3 className="font-bold text-zinc-900 dark:text-white">
              {getLevelTitle()}
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {metricMode === "cost"
              ? `Financial Cost Analysis ($ SGD) • ${tariff.name} (${tariff.nominalVoltage})`
              : "Energy Consumption Analysis (kWh) • Continuous Load Profile"}
          </p>
        </div>

        {/* Interactive Controls Group */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
          {/* Metric Mode Toggle: kWh vs $ Cost */}
          {onMetricModeChange && (
            <div className="flex items-center rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => onMetricModeChange("kwh")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${metricMode === "kwh"
                  ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-700 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
              >
                <Zap className="h-3 w-3 text-emerald-100" />
                <span>kWh Usage</span>
              </button>
              <button
                type="button"
                onClick={() => onMetricModeChange("cost")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${metricMode === "cost"
                  ? "bg-amber-500 text-white shadow-sm dark:bg-amber-600 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
              >
                <DollarSign className="h-3 w-3 text-amber-100" />
                <span>Cost ($ SGD)</span>
              </button>
            </div>
          )}

          {/* Spline Curve vs Bar Toggle (Active for half-hourly) */}
          {level === "halfhourly" && onChartTypeChange && (
            <div className="flex items-center rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => onChartTypeChange("curve")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${chartType === "curve"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
              >
                <LineChart className="h-3 w-3 text-emerald-500" />
                <span>Curve</span>
              </button>
              <button
                type="button"
                onClick={() => onChartTypeChange("bar")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${chartType === "bar"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
              >
                <BarChart2 className="h-3 w-3" />
                <span>Bars</span>
              </button>
            </div>
          )}

          {/* Drill Level Buttons */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
            {(["yearly", "monthly", "daily", "halfhourly"] as DrillLevel[]).map((lvl) => (
              <button
                type="button"
                key={lvl}
                onClick={() => onLevelChange(lvl)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-all cursor-pointer ${level === lvl
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
              >
                {lvl === "halfhourly" ? "Half-Hour" : lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Render Spline Curve or Bars Canvas */}
      {level === "halfhourly" && chartType === "curve" ? (
        <LoadCurveChart
          data={data}
          metricMode={metricMode}
          tariff={tariff}
          onSelect={onSelect}
          premiseName={premiseName}
          voltageType={voltageType}
        />
      ) : (
        <div className="flex h-[320px] w-full items-end gap-1.5 pt-8 pb-10 px-2 sm:gap-2">
          {data.map((item, idx) => {
            const heightRatio = item.total / maxVal;
            const barHeightPx = Math.max(Math.round(heightRatio * chartHeight), 6);
            const isHovered = hoveredIndex === idx;

            const isHalfHourly = level === "halfhourly";
            const isPeakInterval = isHalfHourly
              ? (item.rawPayload?.isPeak ?? (typeof item.peak === "number" ? item.peak > 0 : false))
              : false;

            const hasPeak = typeof item.peak === "number" && item.total > 0;
            const peakRatio = hasPeak
              ? Math.min(100, Math.max(0, (item.peak! / item.total) * 100))
              : 70;
            const offPeakRatio = Math.max(0, 100 - peakRatio);

            return (
              <div
                key={`${item.label}-${idx}`}
                className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSelect(item, idx)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="pointer-events-none absolute bottom-[105%] z-30 mb-2 flex flex-col rounded-xl bg-zinc-900/95 p-3 text-xs text-white shadow-2xl backdrop-blur-md border border-zinc-700/60 min-w-[170px]">
                    <div className="font-semibold text-zinc-100 flex items-center justify-between">
                      <span>{item.label}</span>
                      {item.subLabel && (
                        <span className="text-[10px] text-zinc-400 font-normal">
                          {item.subLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between border-t border-zinc-800 pt-1">
                      <span className="text-zinc-400">Total:</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {isCost ? `$${Math.round(item.total).toLocaleString()}` : `${item.total.toLocaleString()} ${unit}`}
                      </span>
                    </div>

                    {isHalfHourly ? (
                      <div className="mt-1 flex items-center justify-between text-[11px] border-t border-zinc-800/80 pt-1">
                        <span className="text-zinc-400">Tariff Band:</span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${isPeakInterval ? "text-amber-400" : "text-sky-400"
                            }`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${isPeakInterval ? "bg-amber-400" : "bg-sky-400"
                              }`}
                          />
                          {isPeakInterval ? "Peak" : "Off-Peak"}
                        </span>
                      </div>
                    ) : (
                      <>
                        {item.peak !== undefined && (
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="text-amber-400 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Peak:
                            </span>
                            <span className="font-mono text-zinc-200">
                              {isCost ? `$${Math.round(item.peak).toLocaleString()}` : `${Math.round(item.peak).toLocaleString()} ${unit}`}
                            </span>
                          </div>
                        )}
                        {item.offPeak !== undefined && (
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="text-sky-400 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                              Off-Peak:
                            </span>
                            <span className="font-mono text-zinc-200">
                              {isCost ? `$${Math.round(item.offPeak).toLocaleString()}` : `${Math.round(item.offPeak).toLocaleString()} ${unit}`}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {item.kvarh !== undefined && item.kvarh > 0 && (
                      <div className="flex items-baseline justify-between text-[11px] text-purple-400 border-t border-zinc-800 pt-1 mt-1">
                        <span>Reactive:</span>
                        <span className="font-mono">{item.kvarh} kVARh</span>
                      </div>
                    )}
                    {level !== "halfhourly" && (
                      <div className="mt-1 text-[10px] text-zinc-400 italic text-center border-t border-zinc-800 pt-1">
                        Click to drill down &darr;
                      </div>
                    )}
                  </div>
                )}

                {/* Bar Rendering */}
                {isHalfHourly ? (
                  <div
                    style={{ height: `${barHeightPx}px` }}
                    className={`relative flex w-full max-w-[48px] overflow-hidden rounded-t transition-all duration-200 ${isHovered
                      ? "ring-2 ring-emerald-400 scale-[1.03] shadow-lg shadow-emerald-500/10"
                      : "opacity-90 hover:opacity-100"
                      } ${isPeakInterval
                        ? "bg-gradient-to-t from-amber-500 to-amber-400"
                        : "bg-gradient-to-t from-sky-600 to-sky-500"
                      }`}
                  />
                ) : (
                  <div
                    style={{ height: `${barHeightPx}px` }}
                    className={`relative flex w-full max-w-[48px] flex-col overflow-hidden rounded-t transition-all duration-200 ${isHovered
                      ? "ring-2 ring-emerald-400 scale-[1.03] shadow-lg shadow-emerald-500/10"
                      : "opacity-90 hover:opacity-100"
                      }`}
                  >
                    {peakRatio > 0 && (
                      <div
                        style={{ height: `${peakRatio}%` }}
                        className="w-full bg-gradient-to-t from-amber-500 to-amber-400"
                      />
                    )}
                    {offPeakRatio > 0 && (
                      <div
                        style={{ height: `${offPeakRatio}%` }}
                        className="w-full bg-gradient-to-t from-sky-600 to-sky-500"
                      />
                    )}
                  </div>
                )}

                {/* X-axis Label */}
                <div className="absolute -bottom-6 w-full text-center">
                  <span
                    className={`block truncate text-[10px] transition-colors ${isHovered
                      ? "font-semibold text-emerald-400"
                      : "text-zinc-500 dark:text-zinc-400"
                      }`}
                  >
                    {level === "halfhourly"
                      ? idx % 4 === 0
                        ? item.label
                        : ""
                      : item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend & Hint */}
      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-zinc-200/60 dark:border-zinc-800/80 pt-3 text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-amber-400 to-amber-500" />
            <span>Peak (07:00 - 23:00)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-sky-500 to-sky-600" />
            <span>Off-Peak (23:00 - 07:00)</span>
          </div>
        </div>

        {level !== "halfhourly" ? (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
            <span>Click any bar to drill down</span>
            <span>&rarr;</span>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400">
            48 Half-Hourly Intervals (Full Day Load Curve)
          </span>
        )}
      </div>

    </div>
  );
}