"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  BarChart2,
} from "lucide-react";

const navItems = [
  { href: "/board", label: "Board", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-white border-r border-[#D6EAF0]">
      <div className="h-16 flex items-center px-6 border-b border-[#D6EAF0]">
        <span className="text-lg font-semibold tracking-tight text-[#1A8FAF]">
          InkDesk
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#E8F5FA] text-[#1A8FAF]"
                  : "text-gray-600 hover:bg-[#F0F7FA] hover:text-gray-900"
              }`}
            >
              <Icon
                size={18}
                className={isActive ? "text-[#1A8FAF]" : "text-gray-400"}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
