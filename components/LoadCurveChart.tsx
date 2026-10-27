"use client";

import React, { useState, useId } from "react";
import { ChartDatum } from "./ConsumptionChart";
import { TariffStructure } from "@/lib/tariffs";
import { Zap, DollarSign, Activity } from "lucide-react";

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
  // Interval 14 = 07:00 (Start of Peak)
  // Interval 46 = 23:00 (End of Peak / Start of Off-Peak)
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
    <div className="relative w-full select-none">
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
          {/* 1. Morning Off-Peak (00:00 to 07:00) */}
          <rect
            x={padLeft}
            y={padTop}
            width={Math.max(peakStartX - padLeft, 0)}
            height={plotHeight}
            fill={`url(#offPeakGrad-${gradId})`}
          />
          {/* 2. Daytime Peak (07:00 to 23:00) */}
          <rect
            x={peakStartX}
            y={padTop}
            width={Math.max(peakEndX - peakStartX, 0)}
            height={plotHeight}
            fill={`url(#peakBandGrad-${gradId})`}
          />
          {/* 3. Night Off-Peak (23:00 to 24:00) */}
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

          {/* Peak Demand Callout Marker */}
          {hasValidPeak && (
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
                y2={peakPoint.y - 18}
                stroke="#ef4444"
                strokeWidth="1.2"
              />
              <rect
                x={Math.min(Math.max(peakPoint.x - 55, padLeft + 5), padLeft + plotWidth - 110)}
                y={peakPoint.y - 34}
                width="110"
                height="16"
                rx="3"
                fill="#18181b"
                stroke="#ef4444"
                strokeWidth="0.8"
              />
              <text
                x={Math.min(Math.max(peakPoint.x - 55, padLeft + 5), padLeft + plotWidth - 110) + 55}
                y={peakPoint.y - 22}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#fca5a5"
              >
                {metricMode === "cost"
                  ? `Max: $${peakPoint.val.toFixed(1)} @ ${peakPoint.datum.label}`
                  : `Max: ${(peakPoint.val * 2).toFixed(0)} kW @ ${peakPoint.datum.label}`}
              </text>
            </g>
          )}

          {/* Active Hover Snap Indicator */}
          {activePt && (
            <g>
              {/* Vertical Crosshair Line */}
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
              {/* Highlight Point on Curve */}
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

          {/* Interactive Mouse Hover Slices (48 transparent overlay strips) */}
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

          {/* X-Axis Time Labels (Every 3 hours: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00, 23:30) */}
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
            left: `${Math.min(Math.max((activePt.x / svgWidth) * 100 - 10, 4), 74)}%`,
            top: "10px",
          }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-400" />
              {activePt.datum.label} (30 mins)
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                activePt.datum.rawPayload?.isPeak
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

      {/* Legend & Executive Load Profile Notes */}
      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-zinc-200/60 dark:border-zinc-800/80 pt-3 text-xs text-zinc-500">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Peak Hours (07:00–23:00) • ${tariff.peakRate.toFixed(4)}/kWh
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Off-Peak Hours (23:00–07:00) • ${tariff.offPeakRate.toFixed(4)}/kWh
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span>Peak Demand Callout</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium text-zinc-600 dark:text-zinc-300">
            {voltageType} Tariff Schedule
          </span>
          <span>48 Continuous 30-min Intervals</span>
        </div>
      </div>
    </div>
  );
}
