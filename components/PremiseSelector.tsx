"use client";

import React, { useState } from "react";
import type { PremiseItem } from "@/lib/types";
import { Building2, Check, ChevronDown, MapPin, Zap, ShieldCheck } from "lucide-react";

interface PremiseSelectorProps {
  premises: PremiseItem[];
  selectedPremise: PremiseItem;
  onSelect: (premise: PremiseItem) => void;
}

export function PremiseSelector({
  premises,
  selectedPremise,
  onSelect,
}: PremiseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = premises.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.portfolio.toLowerCase().includes(search.toLowerCase()) ||
      p.region.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full">
      {/* Active Premise Card / Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700 cursor-pointer backdrop-blur-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {selectedPremise.portfolio}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
              <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <MapPin className="h-3 w-3" />
                {selectedPremise.region} ({selectedPremise.area})
              </span>
            </div>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {selectedPremise.name}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {selectedPremise.address}
            </p>
          </div>
        </div>

        {/* Metadata Badges & Dropdown Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>{selectedPremise.voltageType}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>GreenMark: {selectedPremise.greenMarkRating}</span>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 transition-colors group-hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-zinc-700">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                }`}
            />
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            {/* Search Input */}
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search premise by name, REIT, or region..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
                autoFocus
              />
            </div>

            {/* Premise List */}
            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.map((item) => {
                const isSelected = item.id === selectedPremise.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelect(item);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl p-3 text-left transition-colors cursor-pointer ${isSelected
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100"
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.name}</span>
                        <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {item.portfolio}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.region} &bull; {item.voltageType} &bull; GreenMark {item.greenMarkRating}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-4 text-center text-sm text-zinc-500">
                  No premise found matching "{search}"
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
