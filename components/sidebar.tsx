"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  BarChart2,
  LogOut,
  Copy,
  Check,
  LinkIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  { href: "/board", label: "Board", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [studioName, setStudioName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setStudioName(user.user_metadata?.studio_name ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("slug")
        .eq("id", user.id)
        .single();
      setSlug(profile?.slug ?? null);
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleCopy() {
    if (!slug) return;
    const url = `${window.location.origin}/intake/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const initial = studioName ? studioName[0].toUpperCase() : "?";
  const intakeUrl = slug ? `/intake/${slug}` : null;

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

      {/* Intake link */}
      {intakeUrl && (
        <div className="mx-3 mb-3 rounded-xl border border-[#D6EAF0] bg-[#F8FCFE] px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <LinkIcon size={11} className="text-[#1A8FAF] shrink-0" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Your intake link
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={intakeUrl}
              target="_blank"
              className="flex-1 min-w-0 text-[11px] text-[#1A8FAF] truncate hover:underline"
            >
              /intake/{slug}
            </Link>
            <button
              onClick={handleCopy}
              title="Copy link"
              className={`shrink-0 size-6 flex items-center justify-center rounded-md transition-colors ${
                copied
                  ? "bg-emerald-50 text-emerald-600"
                  : "hover:bg-[#E8F5FA] text-gray-400 hover:text-[#1A8FAF]"
              }`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Studio identity + sign out */}
      <div className="border-t border-[#D6EAF0]">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="size-8 rounded-full bg-[#E8F5FA] flex items-center justify-center text-sm font-semibold text-[#1A8FAF] shrink-0">
            {initial}
          </div>
          <p className="text-sm font-medium text-gray-800 truncate flex-1">
            {studioName ?? "My Studio"}
          </p>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-[#F0F7FA] hover:text-gray-700 transition-colors"
          >
            <LogOut size={16} className="text-gray-400" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
