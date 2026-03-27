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
  ScrollText,
  Settings,
  LogOut,
  Copy,
  Check,
  LinkIcon,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";

const navItems = [
  { href: "/board", label: "Board", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/waivers", label: "Waivers", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [studioName, setStudioName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
    <aside
      className={`
        flex flex-col bg-[var(--nb-card)] border-r border-[var(--nb-border)]
        fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-in-out
        lg:relative lg:w-60 lg:translate-x-0 lg:z-auto lg:shrink-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--nb-border)] shrink-0">
        <span className="text-lg font-semibold tracking-tight text-[#7C3AED]">
          Needlebook
        </span>
        <button
          onClick={onMobileClose}
          className="lg:hidden size-8 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors text-[var(--nb-text-2)]"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--nb-active-bg)] text-[var(--nb-active-text)]"
                  : "text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] hover:text-[var(--nb-text)]"
              }`}
            >
              <Icon
                size={18}
                className={isActive ? "text-[var(--nb-active-text)]" : "text-[var(--nb-text-2)]"}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 mb-2">
        <button
          onClick={toggle}
          title={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] hover:text-[var(--nb-text)] transition-colors"
        >
          {mounted && theme === "dark" ? (
            <Sun size={18} className="text-[var(--nb-text-2)]" />
          ) : (
            <Moon size={18} className="text-[var(--nb-text-2)]" />
          )}
          {mounted && theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* Intake link */}
      {intakeUrl && (
        <div className="mx-3 mb-3 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <LinkIcon size={11} className="text-[#7C3AED] shrink-0" />
            <span className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
              Your intake link
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={intakeUrl}
              target="_blank"
              className="flex-1 min-w-0 text-[11px] text-[#7C3AED] truncate hover:underline"
            >
              /intake/{slug}
            </Link>
            <button
              onClick={handleCopy}
              title="Copy link"
              className={`shrink-0 size-6 flex items-center justify-center rounded-md transition-colors ${
                copied
                  ? "bg-emerald-50 text-emerald-600"
                  : "hover:bg-[var(--nb-active-bg)] text-[var(--nb-text-2)] hover:text-[#7C3AED]"
              }`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Studio identity + sign out */}
      <div className="border-t border-[var(--nb-border)]">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="size-8 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-sm font-semibold text-[#7C3AED] shrink-0">
            {initial}
          </div>
          <p className="text-sm font-medium text-[var(--nb-text)] truncate flex-1">
            {studioName ?? "My Studio"}
          </p>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] hover:text-[var(--nb-text)] transition-colors"
          >
            <LogOut size={16} className="text-[var(--nb-text-2)]" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
