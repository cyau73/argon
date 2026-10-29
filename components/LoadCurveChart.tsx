"use client";

import React, { useState, useId } from "react";
import { ChartDatum } from "./ConsumptionChart";
import { TariffStructure } from "@/lib/tariffs";
import { Zap, DollarSign, Activity, Info, ChevronDown } from "lucide-react";

interface LoadCurveChartProps {
  data: ChartDatum[];
  metricMode: "kwh" | "cost";
  tariff: TariffStructure;
  onSelect?: (item: ChartDatum, index: number) => void;
  premiseName?: string;
  voltageType?: string;
}

/**
 * Catmull-Rom to Cubic Bezier curve path generator with strict NaN defense
 */
function getCubicBezierPath(points: { x: number; y: number }[]): string {
  const validPts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (validPts.length === 0) return "";
  if (validPts.length === 1) return `M ${validPts[0].x.toFixed(2)} ${validPts[0].y.toFixed(2)}`;

  let d = `M ${validPts[0].x.toFixed(2)} ${validPts[0].y.toFixed(2)}`;

  for (let i = 0; i < validPts.length - 1; i++) {
    const p0 = validPts[i === 0 ? 0 : i - 1];
    const p1 = validPts[i];
    const p2 = validPts[i + 1];
    const p3 = validPts[i + 2 < validPts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

export function LoadCurveChart({
  data,
  metricMode,
  tariff,
  onSelect,
  premiseName,
  voltageType = "HT",
}: LoadCurveChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState<boolean>(false);
  const gradId = useId();

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-zinc-400">
        No half-hourly consumption curve available.
      </div>
    );
  }

  // Width and height of SVG viewBox
  const svgWidth = 900;
  const svgHeight = 320;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;

  const plotWidth = Math.max(svgWidth - padLeft - padRight, 100);
  const plotHeight = Math.max(svgHeight - padTop - padBottom, 100);

  // Values sanitized to prevent any NaN poisoning
  const values = data.map((d) => {
    let rawVal = 0;
    if (typeof d.total === "number" && Number.isFinite(d.total)) {
      rawVal = d.total;
    } else if (d.rawPayload?.kwh && Number.isFinite(Number(d.rawPayload.kwh))) {
      rawVal = Number(d.rawPayload.kwh);
    }

    if (metricMode === "cost") {
      const cost = d.rawPayload?.cost ?? d.cost;
      if (typeof cost === "number" && Number.isFinite(cost)) {
        return cost;
      }
      const rate = d.rawPayload?.isPeak ? (tariff?.peakRate ?? 0.228) : (tariff?.offPeakRate ?? 0.158);
      const net = tariff?.networkRate ?? 0.043;
      return rawVal * (rate + net);
    }
    return rawVal;
  });

  const validValues = values.filter((v) => Number.isFinite(v) && v >= 0);
  const maxVal = (validValues.length > 0 ? Math.max(...validValues, 1) : 1) * 1.12;
  const minVal = 0;
  const yRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

  // Map data points to SVG coordinate space
  const len = data.length > 1 ? data.length - 1 : 1;
  const points = data.map((d, i) => {
    const val = Number.isFinite(values[i]) ? values[i] : 0;
    const x = padLeft + (i / len) * plotWidth;
    const y = padTop + plotHeight - ((val - minVal) / yRange) * plotHeight;
    const safeX = Number.isFinite(x) ? x : padLeft;
    const safeY = Number.isFinite(y) ? y : padTop + plotHeight;
    return { x: safeX, y: safeY, val, datum: d, index: i };
  });

  // Calculate curve paths
  const curveLinePath = getCubicBezierPath(points);
  const baselineY = padTop + plotHeight;
  const firstPt = points[0] ?? { x: padLeft, y: baselineY };
  const lastPt = points[points.length - 1] ?? { x: padLeft + plotWidth, y: baselineY };
  const areaPath = curveLinePath
    ? `${curveLinePath} L ${lastPt.x.toFixed(2)} ${baselineY.toFixed(2)} L ${firstPt.x.toFixed(2)} ${baselineY.toFixed(2)} Z`
    : "";

  // Find peak point (Max demand)
  let maxIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[maxIdx]) maxIdx = i;
  }
  const peakPoint = points[maxIdx];
  const hasValidPeak =
    peakPoint &&
    Number.isFinite(peakPoint.x) &&
    Number.isFinite(peakPoint.y) &&
    peakPoint.val > 0;

  // Tariff shift interval boundary X coordinates
  const peakStartX = padLeft + (14 / len) * plotWidth;
  const peakEndX = padLeft + (46 / len) * plotWidth;

  // Active hover point
  const activePt =
    hoveredIdx !== null && points[hoveredIdx] && Number.isFinite(points[hoveredIdx].x)
      ? points[hoveredIdx]
      : null;

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minVal + pct * (maxVal - minVal);
    const y = padTop + plotHeight - pct * plotHeight;
    return { val, y: Number.isFinite(y) ? y : padTop };
  });

  return (
    <div className="relative w-full select-none flex flex-col gap-2">
      {/* Top Action Bar for Info Toggle */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Interactive Half-Hourly Profile (48 Intervals)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowInfoDrawer(!showInfoDrawer)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
        >
          <Info className="h-3.5 w-3.5 text-emerald-500" />
          <span>Tariff Schedule Info</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showInfoDrawer ? "rotate-180" : ""
              }`}
          />
        </button>
      </div>

      {/* Collapsible Tariff Schedule & Legend Info Drawer */}
      <div
        className={`grid transition-all duration-300 ease-in-out overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 ${showInfoDrawer ? "grid-rows-[1fr] opacity-100 p-3 sm:p-4 mb-2" : "grid-rows-[0fr] opacity-0 p-0 mb-0 border-0"
          }`}
      >
        <div className="overflow-hidden flex flex-col gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
            <span>{voltageType} Tariff Structure & Rate Bands</span>
            <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
              {tariff.name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 rounded-lg bg-white dark:bg-zinc-800/60 p-2.5 border border-zinc-200/60 dark:border-zinc-700/50">
              <span className="h-3 w-3 rounded-sm bg-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">Peak Hours (07:00 – 23:00)</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Standard Rate: <span className="font-mono font-semibold text-amber-500">${tariff.peakRate.toFixed(4)} / kWh</span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg bg-white dark:bg-zinc-800/60 p-2.5 border border-zinc-200/60 dark:border-zinc-700/50">
              <span className="h-3 w-3 rounded-sm bg-sky-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">Off-Peak Hours (23:00 – 07:00)</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Discounted Rate: <span className="font-mono font-semibold text-sky-500">${tariff.offPeakRate.toFixed(4)} / kWh</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-200/60 dark:border-zinc-800 pt-2">
            <span>Network Transmission Rate: <strong className="font-mono text-zinc-600 dark:text-zinc-300">${tariff.networkRate?.toFixed(3) ?? "0.043"} / kWh</strong></span>
            <span>Red marker indicates peak demand interval across the 24-hour cycle.</span>
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[380px] overflow-visible"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Area Fill Gradient */}
            <linearGradient id={`curveGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metricMode === "cost" ? "#f59e0b" : "#10b981"} stopOpacity="0.38" />
              <stop offset="65%" stopColor={metricMode === "cost" ? "#d97706" : "#059669"} stopOpacity="0.10" />
              <stop offset="100%" stopColor={metricMode === "cost" ? "#b45309" : "#047857"} stopOpacity="0.0" />
            </linearGradient>

            {/* Peak Band Shading Pattern */}
            <linearGradient id={`peakBandGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
            </linearGradient>

            {/* Off-Peak Band Shading */}
            <linearGradient id={`offPeakGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.01" />
            </linearGradient>

            {/* Line Glow Filter */}
            <filter id={`glow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Tariff Zones */}
          <rect
            x={padLeft}
            y={padTop}
            width={Math.max(peakStartX - padLeft, 0)}
            height={plotHeight}
            fill={`url(#offPeakGrad-${gradId})`}
          />
          <rect
            x={peakStartX}
            y={padTop}
            width={Math.max(peakEndX - peakStartX, 0)}
            height={plotHeight}
            fill={`url(#peakBandGrad-${gradId})`}
          />
          <rect
            x={peakEndX}
            y={padTop}
            width={Math.max(padLeft + plotWidth - peakEndX, 0)}
            height={plotHeight}
            fill={`url(#offPeakGrad-${gradId})`}
          />

          {/* Tariff Band Demarcation Lines */}
          <line
            x1={peakStartX}
            y1={padTop}
            x2={peakStartX}
            y2={baselineY}
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          <line
            x1={peakEndX}
            y1={padTop}
            x2={peakEndX}
            y2={baselineY}
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.5"
          />

          {/* Tariff Zone Top Badges */}
          <text
            x={(padLeft + peakStartX) / 2}
            y={padTop + 14}
            fill="#0284c7"
            fontSize="10"
            fontWeight="600"
            textAnchor="middle"
            className="opacity-75"
          >
            OFF-PEAK (23:00–07:00)
          </text>
          <text
            x={(peakStartX + peakEndX) / 2}
            y={padTop + 14}
            fill="#d97706"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            className="opacity-80"
          >
            PEAK TARIFF WINDOW (07:00–23:00)
          </text>
          <text
            x={(peakEndX + padLeft + plotWidth) / 2}
            y={padTop + 14}
            fill="#0284c7"
            fontSize="9"
            fontWeight="600"
            textAnchor="middle"
            className="opacity-75"
          >
            OFF-PEAK
          </text>

          {/* Horizontal Grid Lines & Y-Axis Labels */}
          {yTicks.map((tick, i) => (
            <g key={`ytick-${i}`}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + plotWidth}
                y2={tick.y}
                stroke="#71717a"
                strokeWidth="0.8"
                strokeDasharray="3 3"
                opacity="0.25"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#a1a1aa"
                fontWeight="500"
                fontFamily="monospace"
              >
                {metricMode === "cost"
                  ? `$${Math.round(tick.val).toLocaleString()}`
                  : `${Math.round(tick.val).toLocaleString()}`}
              </text>
            </g>
          ))}

          {/* Area Fill Under Curve */}
          {areaPath && <path d={areaPath} fill={`url(#curveGrad-${gradId})`} />}

          {/* Smooth Spline Curve Line */}
          {curveLinePath && (
            <path
              d={curveLinePath}
              fill="none"
              stroke={metricMode === "cost" ? "#f59e0b" : "#10b981"}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${gradId})`}
            />
          )}

          {/* Baseline Axis Line */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={padLeft + plotWidth}
            y2={baselineY}
            stroke="#71717a"
            strokeWidth="1.2"
            opacity="0.4"
          />

          {/* Peak Demand Callout Marker (Smart Flipping if near top) */}
          {hasValidPeak && (() => {
            const isNearTop = peakPoint.y < padTop + 55;
            const boxY = isNearTop ? peakPoint.y + 12 : peakPoint.y - 34;
            const lineY2 = isNearTop ? peakPoint.y + 12 : peakPoint.y - 18;
            const textY = isNearTop ? peakPoint.y + 23 : peakPoint.y - 22;

            return (
              <g>
                <circle
                  cx={peakPoint.x}
                  cy={peakPoint.y}
                  r="5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="animate-pulse"
                />
                <line
                  x1={peakPoint.x}
                  y1={peakPoint.y}
                  x2={peakPoint.x}
                  y2={lineY2}
                  stroke="#ef4444"
                  strokeWidth="1.2"
                />
                <rect
                  x={Math.min(Math.max(peakPoint.x - 55, padLeft + 5), padLeft + plotWidth - 110)}
                  y={boxY}
                  width="110"
                  height="16"
                  rx="3"
                  fill="#18181b"
                  stroke="#ef4444"
                  strokeWidth="0.8"
                />
                <text
                  x={Math.min(Math.max(peakPoint.x - 55, padLeft + 5), padLeft + plotWidth - 110) + 55}
                  y={textY}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#fca5a5"
                >
                  {metricMode === "cost"
                    ? `Max: $${peakPoint.val.toFixed(1)} @ ${peakPoint.datum.label}`
                    : `Max: ${(peakPoint.val).toFixed(0)} kW @ ${peakPoint.datum.label}`}
                </text>
              </g>
            );
          })()}

          {/* Active Hover Snap Indicator */}
          {activePt && (
            <g>
              <line
                x1={activePt.x}
                y1={padTop}
                x2={activePt.x}
                y2={baselineY}
                stroke={activePt.datum.rawPayload?.isPeak ? "#f59e0b" : "#0284c7"}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <circle
                cx={activePt.x}
                cy={activePt.y}
                r="6"
                fill={activePt.datum.rawPayload?.isPeak ? "#f59e0b" : "#0284c7"}
                stroke="#ffffff"
                strokeWidth="2.5"
                className="shadow-lg"
              />
            </g>
          )}

          {/* Interactive Mouse Hover Slices */}
          {points.map((pt, i) => {
            const stripWidth = plotWidth / len;
            const stripX = pt.x - stripWidth / 2;
            return (
              <rect
                key={`hit-${i}`}
                x={stripX}
                y={padTop}
                width={stripWidth}
                height={plotHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => onSelect && onSelect(pt.datum, i)}
              />
            );
          })}

          {/* X-Axis Time Labels */}
          {points
            .filter((_, idx) => idx % 6 === 0 || idx === points.length - 1)
            .map((pt, idx) => (
              <text
                key={`time-${idx}`}
                x={pt.x}
                y={baselineY + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#a1a1aa"
                fontWeight="500"
              >
                {pt.datum.label}
              </text>
            ))}
        </svg>
      </div>

      {/* Floating Precision Hover Tooltip */}
      {activePt && (
        <div
          className="pointer-events-none absolute z-30 flex flex-col rounded-xl bg-zinc-900/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md border border-zinc-700/60 min-w-[210px] transition-all"
          style={{
            left: `${Math.min(Math.max((activePt.x / svgWidth) * 100, 4), 74)}%`,
            top: "55px",
          }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-400" />
              {activePt.datum.label} (30 mins)
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${activePt.datum.rawPayload?.isPeak
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                }`}
            >
              {activePt.datum.rawPayload?.isPeak ? "Peak Band" : "Off-Peak Band"}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                Consumption:
              </span>
              <span className="font-mono font-semibold text-zinc-100">
                {(activePt.datum.rawPayload?.kwh ?? activePt.val).toLocaleString()} kWh
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Demand Load:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {((activePt.datum.rawPayload?.kwh ?? activePt.val) * 2).toLocaleString()} kW
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-1.5">
              <span className="text-zinc-400 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                Interval Spend:
              </span>
              <span className="font-mono font-bold text-amber-400">
                ${(activePt.datum.rawPayload?.cost ?? (activePt.val * (activePt.datum.rawPayload?.isPeak ? tariff.peakRate : tariff.offPeakRate))).toFixed(2)} SGD
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Applied Tariff:</span>
              <span className="font-mono text-zinc-300">
                ${activePt.datum.rawPayload?.isPeak ? tariff.peakRate.toFixed(4) : tariff.offPeakRate.toFixed(4)} / kWh ({tariff.code})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}