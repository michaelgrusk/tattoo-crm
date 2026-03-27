"use client";

import { useState, useRef } from "react";
import { Search, UserPlus, CheckCircle2, Users, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ClientListItem } from "../page";
import { ClientDetailPanel } from "./client-detail-panel";
import { AddClientDialog } from "./add-client-dialog";
import { Button } from "@/components/ui/button";

// ─── Status config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  new_lead:             { label: "New Lead",            dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50"    },
  consultation_booked:  { label: "Consultation Booked", dot: "bg-violet-400",  text: "text-violet-700",  bg: "bg-violet-50"  },
  first_session_done:   { label: "1st Session Done",    dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
  healing_followup:     { label: "Healing Follow-up",   dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50"   },
  touchup_followup:     { label: "Touch-up Follow-up",  dot: "bg-orange-400",  text: "text-orange-700",  bg: "bg-orange-50"  },
  repeat_client:        { label: "Repeat Client",       dot: "bg-teal-400",    text: "text-teal-700",    bg: "bg-teal-50"    },
  inactive:             { label: "Inactive",            dot: "bg-gray-400",    text: "text-gray-600",    bg: "bg-gray-100"   },
};

const STATUS_KEYS = Object.keys(STATUS_CONFIG);

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "bg-sky-100",    text: "text-sky-700"    },
  { bg: "bg-emerald-100",text: "text-emerald-700"},
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-amber-100",  text: "text-amber-700"  },
  { bg: "bg-rose-100",   text: "text-rose-700"   },
  { bg: "bg-teal-100",   text: "text-teal-700"   },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const cfg = status ? STATUS_CONFIG[status] : null;
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.text} ${cfg.bg}`}>
      <span className={`size-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── ClientRow ────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  isSelected,
  onClick,
}: {
  client: ClientListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = getAvatarColor(client.name);
  const initials = getInitials(client.name);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all rounded-lg ${
        isSelected
          ? "bg-[var(--nb-active-bg)] shadow-[inset_3px_0_0_0_#7C3AED]"
          : "hover:bg-[var(--nb-card)]"
      }`}
    >
      <div
        className={`size-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${color.bg} ${color.text}`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isSelected ? "text-[#7C3AED]" : "text-[var(--nb-text)]"}`}>
          {client.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusBadge status={client.status} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-[var(--nb-text)]">
          ${client.totalSpent.toLocaleString()}
        </p>
        <p className="text-xs text-[var(--nb-text-2)]">
          {client.sessions} session{client.sessions !== 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContactsView({ clients }: { clients: ClientListItem[] }) {
  const router = useRouter();
  const [localClients, setLocalClients] = useState(clients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | number | null>(
    clients[0]?.id ?? null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fireToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function handleClientDeleted(deletedId: string | number) {
    const idx = localClients.findIndex((c) => c.id === deletedId);
    const next = localClients[idx + 1] ?? localClients[idx - 1] ?? null;
    setLocalClients((prev) => prev.filter((c) => c.id !== deletedId));
    setSelectedId(next?.id ?? null);
    fireToast("Client deleted");
    router.refresh();
  }

  function handleClientUpdated(updated: ClientListItem) {
    setLocalClients((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  }

  // Search + status filter
  const filtered = localClients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search);
    const matchesStatus = statusFilter === null || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Counts per status (from all clients, not filtered by status)
  const searchFiltered = localClients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  );
  const statusCounts: Record<string, number> = {};
  for (const key of STATUS_KEYS) {
    statusCounts[key] = searchFiltered.filter((c) => c.status === key).length;
  }

  const selectedClient = localClients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      {/* Left panel — full width on mobile (list view), fixed width sidebar on md+ */}
      <div className={`flex-col border-r border-[var(--nb-border)] bg-[var(--nb-card)] w-full md:w-80 md:shrink-0 ${mobileView === "detail" ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-[var(--nb-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--nb-text)]">Contacts</h1>
              <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                {localClients.length} client{localClients.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 shrink-0"
            >
              <UserPlus size={14} />
              Add Client
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)]" />
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded-lg outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)]"
            />
          </div>

          {/* Status filter pills — horizontally scrollable */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setStatusFilter(null)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === null
                  ? "bg-[#7C3AED] text-white"
                  : "bg-[var(--nb-bg)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)] border border-[var(--nb-border)]"
              }`}
            >
              All
              <span className={`rounded-full px-1.5 leading-none text-[10px] ${statusFilter === null ? "bg-white/20" : "bg-[var(--nb-border)]"}`}>
                {searchFiltered.length}
              </span>
            </button>
            {STATUS_KEYS.map((key) => {
              const cfg = STATUS_CONFIG[key];
              const count = statusCounts[key];
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(isActive ? null : key)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                    isActive
                      ? `${cfg.bg} ${cfg.text} border-transparent`
                      : "bg-[var(--nb-bg)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:text-[var(--nb-text)]"
                  }`}
                >
                  <span className={`size-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  {cfg.label}
                  <span className={`rounded-full px-1.5 leading-none text-[10px] ${isActive ? "bg-black/10" : "bg-[var(--nb-border)]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-4 text-center">
              <Users size={28} className="text-[var(--nb-border)] mb-3" />
              <p className="text-sm font-medium text-[var(--nb-text-2)]">No clients found</p>
              <p className="text-xs text-[var(--nb-text-2)] mt-1">
                {search || statusFilter ? "Try a different filter" : "Add your first client above"}
              </p>
            </div>
          ) : (
            filtered.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                isSelected={client.id === selectedId}
                onClick={() => { setSelectedId(client.id); setMobileView("detail"); }}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — full width on mobile (detail view), flex-1 on md+ */}
      <div className={`flex-1 flex flex-col overflow-y-auto bg-[var(--nb-bg)] ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
        {/* Mobile back button */}
        <div className="md:hidden px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={() => setMobileView("list")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7C3AED] hover:underline"
          >
            <ArrowLeft size={16} />
            All Clients
          </button>
        </div>
        {selectedClient ? (
          <ClientDetailPanel
            client={selectedClient}
            onDeleted={handleClientDeleted}
            onUpdated={handleClientUpdated}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--nb-text-2)]">
            Select a client to view details
          </div>
        )}
      </div>

      <AddClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium bg-emerald-600 text-white animate-in slide-in-from-bottom-4 fade-in duration-200">
          <CheckCircle2 size={16} className="shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
