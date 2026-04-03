"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Users2,
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
  Images,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";

const navItems = [
  { href: "/board", label: "Board", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/artists", label: "Artists", icon: Users2 },
  { href: "/portfolio", label: "Portfolio", icon: Images },
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [boardCount, setBoardCount] = useState<number>(0);
  const [contactsBadge, setContactsBadge] = useState<number>(0);

  useEffect(() => { setMounted(true); }, []);

  // Real-time badge bump when a new board request is manually added
  useEffect(() => {
    function onBoardBadge() { setBoardCount((n) => n + 1); }
    window.addEventListener("nb:board-badge", onBoardBadge);
    return () => window.removeEventListener("nb:board-badge", onBoardBadge);
  }, []);

  useEffect(() => {
    function onContactsBadge() { setContactsBadge((n) => n + 1); }
    window.addEventListener("nb:contacts-badge", onContactsBadge);
    return () => window.removeEventListener("nb:contacts-badge", onContactsBadge);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setStudioName(user.user_metadata?.studio_name ?? null);

      const pad = (n: number) => String(n).padStart(2, "0");
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      const [{ data: profile }, { count: calCount }, { count: boardC }, { count: leadsCount }] = await Promise.all([
        supabase.from("profiles").select("slug, avatar_url").eq("id", user.id).single(),
        // Calendar: only today's appointments, not completed or cancelled
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("date", todayStr)
          .neq("status", "completed")
          .neq("status", "cancelled"),
        // Board: unactioned new requests
        supabase.from("tattoo_requests").select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "new_request"),
        // Contacts: new_lead clients
        supabase.from("clients").select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "new_lead"),
      ]);

      setSlug(profile?.slug ?? null);
      setAvatarUrl(profile?.avatar_url ?? null);
      setTodayCount(calCount ?? 0);
      setBoardCount(boardC ?? 0);
      setContactsBadge(leadsCount ?? 0);
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
      <div className="flex items-center justify-between border-b border-[var(--nb-border)] shrink-0" style={{ padding: "12px 16px" }}>
        <Image src="/logo.png" alt="Needlebook" width={178} height={60} className="rounded-xl min-w-0 shrink" style={{ width: "100%", height: "auto" }} priority loading="eager" />
        <button
          onClick={onMobileClose}
          className="lg:hidden size-8 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors text-[var(--nb-text-2)]"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");

          // Badge value for this nav item
          let badge = 0;
          if (href === "/calendar") badge = todayCount;
          if (href === "/board") badge = boardCount;
          if (href === "/contacts") badge = contactsBadge;

          function handleClick() {
            if (href === "/contacts") setContactsBadge(0);
            onMobileClose?.();
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={handleClick}
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
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                  isActive
                    ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                    : "bg-[#7C3AED] text-white"
                }`}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section — always visible */}
      <div className="shrink-0">

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
          <div className="size-8 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-sm font-semibold text-[#7C3AED] shrink-0 overflow-hidden">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={studioName ?? "Avatar"} width={32} height={32} className="size-8 rounded-full object-cover" unoptimized />
            ) : initial}
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

      </div>{/* end bottom section */}
    </aside>
  );
}
