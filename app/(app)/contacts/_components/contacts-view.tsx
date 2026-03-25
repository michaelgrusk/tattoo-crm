"use client";

import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
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
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded-lg ${
        isSelected
          ? "bg-[#E8F5FA] border border-[#B8DDE8]"
          : "hover:bg-[#F8FCFE] border border-transparent"
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
            isSelected ? "text-[#1A8FAF]" : "text-gray-900"
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
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    clients[0]?.id ?? null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  );

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[#D6EAF0] bg-white">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-[#D6EAF0]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {clients.length} client{clients.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5 shrink-0"
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
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#F0F7FA] border border-[#D6EAF0] rounded-lg outline-none focus:border-[#1A8FAF] focus:ring-2 focus:ring-[#1A8FAF]/20 transition-colors placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">
              No clients found
            </p>
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
      <div className="flex-1 overflow-y-auto bg-[#F0F7FA]">
        {selectedClient ? (
          <ClientDetailPanel client={selectedClient} />
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
    </div>
  );
}
