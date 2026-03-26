"use client";

import { useState, useRef } from "react";
import { Search, UserPlus, CheckCircle2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ClientListItem } from "../page";
import { ClientDetailPanel } from "./client-detail-panel";
import { AddClientDialog } from "./add-client-dialog";
import { Button } from "@/components/ui/button";

const AVATAR_COLORS = [
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
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
      className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all rounded-lg ${
        isSelected
          ? "bg-[#1A1425] shadow-[inset_3px_0_0_0_#7C3AED]"
          : "hover:bg-[#1C1C24]"
      }`}
    >
      <div
        className={`size-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${color.bg} ${color.text}`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            isSelected ? "text-[#7C3AED]" : "text-gray-900"
          }`}
        >
          {client.name}
        </p>
        <p className="text-xs text-gray-400 truncate">{client.email}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-gray-900">
          ${client.totalSpent.toLocaleString()}
        </p>
        <p className="text-xs text-gray-400">
          {client.sessions} session{client.sessions !== 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}

export function ContactsView({ clients }: { clients: ClientListItem[] }) {
  const router = useRouter();
  const [localClients, setLocalClients] = useState(clients);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | number | null>(
    clients[0]?.id ?? null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const filtered = localClients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  );

  const selectedClient = localClients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[#2A2A34] bg-[#1C1C24]">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-[#2A2A34]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
              <p className="text-xs text-gray-400 mt-0.5">
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
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#0F0F13] border border-[#2A2A34] rounded-lg outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-4 text-center">
              <Users size={28} className="text-[#2A2A34] mb-3" />
              <p className="text-sm font-medium text-gray-500">No clients found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? "Try a different search term" : "Add your first client above"}
              </p>
            </div>
          ) : (
            filtered.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                isSelected={client.id === selectedId}
                onClick={() => setSelectedId(client.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto bg-[#0F0F13]">
        {selectedClient ? (
          <ClientDetailPanel
            client={selectedClient}
            onDeleted={handleClientDeleted}
            onUpdated={handleClientUpdated}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
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
