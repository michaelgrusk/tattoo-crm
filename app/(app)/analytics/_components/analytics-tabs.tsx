"use client";

import { useState } from "react";
import { BarChart2, Zap } from "lucide-react";
import { AnalyticsView } from "./analytics-view";
import { ROIView } from "./roi-view";

type Tab = "analytics" | "roi";

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "analytics", label: "Revenue Analytics", icon: BarChart2 },
  { value: "roi",       label: "ROI Calculator",    icon: Zap        },
];

export function AnalyticsTabs() {
  const [tab, setTab] = useState<Tab>("analytics");

  return (
    <div className="flex flex-col min-h-full">
      {/* Tab bar */}
      <div className="shrink-0 px-4 md:px-8 border-b border-[var(--nb-border)] bg-[var(--nb-card)]">
        <div className="flex gap-0 -mb-px">
          {TABS.map(({ value, label, icon: Icon }) => {
            const active = tab === value;
            return (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-[#7C3AED] text-[#7C3AED]"
                    : "border-transparent text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active view */}
      {tab === "analytics" ? <AnalyticsView /> : <ROIView />}
    </div>
  );
}
