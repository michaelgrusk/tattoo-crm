"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { CurrencyProvider } from "@/components/currency-provider";

export function AppShell({
  children,
  initialCurrency = "USD",
}: {
  children: React.ReactNode;
  initialCurrency?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <CurrencyProvider initialCurrency={initialCurrency}>
      <div className="flex h-screen overflow-hidden bg-[var(--nb-bg)]">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile top bar — hidden on lg+ since sidebar is always visible */}
          <header className="lg:hidden flex items-center h-14 px-4 border-b border-[var(--nb-border)] bg-[var(--nb-card)] shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="size-10 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} className="text-[var(--nb-text-2)]" />
            </button>
            <span className="ml-3 font-semibold text-[#7C3AED]">Tatflow</span>
          </header>

          <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
