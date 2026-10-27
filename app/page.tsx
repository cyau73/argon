import { DrilldownDashboard } from "@/components/DrilldownDashboard";
import { fetchPremises } from "@/lib/consumption";
import { Zap, Database, Globe2, ShieldCheck, Terminal } from "lucide-react";

export const instant = false;

export default async function Home() {
  const premises = await fetchPremises();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 dark:border-zinc-800/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight">ARGON</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Energy OS
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Premise Energy Intelligence & Consumption Drilldown
              </p>
            </div>
          </div>

          {/* Right Action / Mode Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Public Demo Mode</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-2 py-2 sm:px-2 lg:px-2">
        {/* Intro Hero Section 
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Premise Consumption Analytics
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            Explore active commercial premises across Singapore. Click on any bar to seamlessly drill down through four levels of granularity:{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Yearly &rarr; Monthly &rarr; Daily &rarr; Half-Hourly Load Profiles
            </span>
            .
          </p>
        </div>
*/}

        {/* Interactive Drilldown Dashboard */}
        <DrilldownDashboard initialPremises={premises} />

      </main>
    </div>
  );
}
