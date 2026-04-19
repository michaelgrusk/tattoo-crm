"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { useCurrency } from "@/components/currency-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientResult = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
};

type RequestResult = {
  id: string;
  client_name: string;
  style: string | null;
  description: string;
  status: string;
};

type InvoiceResult = {
  id: string | number;
  amount: number;
  status: string;
  date: string;
  type: string | null;
  clients: { name: string } | null;
};

type ArtistResult = {
  id: number;
  name: string;
  bio: string | null;
  styles: string[];
  avatar_url: string | null;
};

type SearchResults = {
  clients: ClientResult[];
  requests: RequestResult[];
  invoices: InvoiceResult[];
  artists: ArtistResult[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function invoiceNum(id: string | number) {
  return `#${String(id).padStart(4, "0")}`;
}

function fmtStatus(s: string) {
  return s.split(/[\s_]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  paid:          "bg-emerald-50 text-emerald-700",
  pending:       "bg-amber-50 text-amber-700",
  overdue:       "bg-red-50 text-red-600",
  deposit:       "bg-sky-50 text-sky-700",
  new_lead:      "bg-sky-50 text-sky-700",
  active:        "bg-emerald-50 text-emerald-700",
  "new request": "bg-sky-50 text-sky-700",
  "quote sent":  "bg-amber-50 text-amber-700",
  "deposit paid":"bg-violet-50 text-violet-700",
  booked:        "bg-emerald-50 text-emerald-700",
  completed:     "bg-emerald-50 text-emerald-700",
};

// ─── Highlight matching text ──────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent text-[#7C3AED] font-semibold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-4 pt-3.5 pb-1 flex items-center gap-2">
      <span className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[10px] font-medium text-[var(--nb-text-2)] bg-[var(--nb-border)] rounded-full px-1.5 py-0.5 leading-none tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
        active ? "bg-[var(--nb-active-bg)]" : "hover:bg-[var(--nb-bg)]"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { format } = useCurrency();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state and auto-focus when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key closes; prevent scroll on body
  useEffect(() => {
    if (!open) return;
    const savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = savedOverflow;
    };
  }, [open, onClose]);

  // Core search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);

    const userId = await getUserId();
    if (!userId) { setLoading(false); return; }

    const like = `%${q}%`;

    // Invoice number: strip leading # and zeros, parse as int
    const rawNum = q.replace(/^#/, "").replace(/^0+(?=\d)/, "");
    const numId = parseInt(rawNum, 10);
    const invoiceOrParts = [`type.ilike.${like}`];
    if (!isNaN(numId) && numId > 0) invoiceOrParts.push(`id.eq.${numId}`);

    const [clientsRes, requestsRes, invoicesRes, artistsRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, email, phone, status")
        .eq("user_id", userId)
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(4),
      supabase
        .from("tattoo_requests")
        .select("id, client_name, style, description, status")
        .eq("user_id", userId)
        .or(`client_name.ilike.${like},description.ilike.${like},style.ilike.${like}`)
        .limit(4),
      supabase
        .from("invoices")
        .select("id, amount, status, type, date, clients(name)")
        .eq("user_id", userId)
        .or(invoiceOrParts.join(","))
        .limit(4),
      supabase
        .from("artists")
        .select("id, name, bio, styles, avatar_url")
        .eq("user_id", userId)
        .or(`name.ilike.${like},bio.ilike.${like}`)
        .eq("is_active", true)
        .limit(4),
    ]);

    setResults({
      clients: (clientsRes.data as ClientResult[]) ?? [],
      requests: (requestsRes.data as RequestResult[]) ?? [],
      invoices: (invoicesRes.data as unknown as InvoiceResult[]) ?? [],
      artists: (artistsRes.data as unknown as ArtistResult[]) ?? [],
    });
    setActiveIndex(-1);
    setLoading(false);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  }

  function clearQuery() {
    setQuery("");
    setResults(null);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  // ── Flat item list for keyboard nav ─────────────────────────────────────────

  type NavAction = () => void;

  function buildFlatItems(): NavAction[] {
    if (!results) return [];
    const items: NavAction[] = [];
    for (const c of results.clients)  items.push(() => { router.push(`/contacts?client=${c.id}`); onClose(); });
    for (const _r of results.requests) items.push(() => { router.push("/board"); onClose(); });
    for (const _i of results.invoices) items.push(() => { router.push("/invoices"); onClose(); });
    for (const _a of results.artists)  items.push(() => { router.push("/artists"); onClose(); });
    return items;
  }

  const flatItems = buildFlatItems();

  function offset(section: "clients" | "requests" | "invoices" | "artists") {
    if (!results) return 0;
    const base = {
      clients: 0,
      requests: results.clients.length,
      invoices: results.clients.length + results.requests.length,
      artists:  results.clients.length + results.requests.length + results.invoices.length,
    };
    return base[section];
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const total = flatItems.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      flatItems[activeIndex]?.();
    }
  }

  const hasResults =
    results &&
    (results.clients.length + results.requests.length +
      results.invoices.length + results.artists.length) > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh] px-3 sm:px-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-xl bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "80vh" }}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label="Global search"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--nb-border)] shrink-0">
          {loading
            ? <Loader2 size={17} className="text-[var(--nb-text-2)] shrink-0 animate-spin" />
            : <Search size={17} className="text-[var(--nb-text-2)] shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search clients, requests, invoices, artists…"
            className="flex-1 bg-transparent text-sm text-[var(--nb-text)] placeholder:text-[var(--nb-text-2)] outline-none min-w-0"
          />
          {query ? (
            <button
              type="button"
              onClick={clearQuery}
              className="shrink-0 size-5 flex items-center justify-center rounded-full hover:bg-[var(--nb-bg)] text-[var(--nb-text-2)] transition-colors"
              aria-label="Clear"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex shrink-0 items-center text-[10px] font-medium text-[var(--nb-text-2)] bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded px-1.5 py-0.5">
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {/* Prompt */}
          {query.length < 2 && (
            <p className="text-sm text-[var(--nb-text-2)] text-center py-10 px-4">
              Type to search clients, requests, invoices and artists
            </p>
          )}

          {/* No results */}
          {query.length >= 2 && !loading && results && !hasResults && (
            <p className="text-sm text-[var(--nb-text-2)] text-center py-10 px-4">
              No results for{" "}
              <span className="text-[var(--nb-text)] font-medium">&ldquo;{query}&rdquo;</span>
            </p>
          )}

          {/* ── Clients ── */}
          {results && results.clients.length > 0 && (
            <div>
              <SectionHeading label="Clients" count={results.clients.length} />
              {results.clients.map((client, i) => (
                <ResultRow
                  key={client.id}
                  active={activeIndex === offset("clients") + i}
                  onClick={() => { router.push(`/contacts?client=${client.id}`); onClose(); }}
                >
                  <div className="size-8 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-xs font-bold text-[#7C3AED] shrink-0">
                    {client.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                      <Highlight text={client.name} query={query} />
                    </p>
                    {client.email && (
                      <p className="text-xs text-[var(--nb-text-2)] truncate">
                        <Highlight text={client.email} query={query} />
                      </p>
                    )}
                  </div>
                  {client.status && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[client.status] ?? "bg-[var(--nb-border)] text-[var(--nb-text-2)]"}`}>
                      {fmtStatus(client.status)}
                    </span>
                  )}
                </ResultRow>
              ))}
            </div>
          )}

          {/* ── Requests ── */}
          {results && results.requests.length > 0 && (
            <div>
              <SectionHeading label="Requests" count={results.requests.length} />
              {results.requests.map((req, i) => {
                const descLine = req.description.split("\n")[0] ?? "";
                return (
                  <ResultRow
                    key={req.id}
                    active={activeIndex === offset("requests") + i}
                    onClick={() => { router.push("/board"); onClose(); }}
                  >
                    <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                        <Highlight text={req.client_name} query={query} />
                      </p>
                      {descLine && (
                        <p className="text-xs text-[var(--nb-text-2)] truncate">
                          <Highlight text={descLine} query={query} />
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {req.style && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--nb-active-bg)] text-[#7C3AED]">
                          {req.style}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] ?? "bg-[var(--nb-border)] text-[var(--nb-text-2)]"}`}>
                        {fmtStatus(req.status)}
                      </span>
                    </div>
                  </ResultRow>
                );
              })}
            </div>
          )}

          {/* ── Invoices ── */}
          {results && results.invoices.length > 0 && (
            <div>
              <SectionHeading label="Invoices" count={results.invoices.length} />
              {results.invoices.map((inv, i) => (
                <ResultRow
                  key={inv.id}
                  active={activeIndex === offset("invoices") + i}
                  onClick={() => { router.push("/invoices"); onClose(); }}
                >
                  <div className="size-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                      {invoiceNum(inv.id)}
                      {inv.clients?.name && (
                        <span className="text-[var(--nb-text-2)] font-normal"> · {inv.clients.name}</span>
                      )}
                    </p>
                    {inv.type && (
                      <p className="text-xs text-[var(--nb-text-2)] truncate">
                        <Highlight text={inv.type} query={query} />
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-semibold text-[var(--nb-text)] tabular-nums">
                      {format(inv.amount)}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] ?? "bg-[var(--nb-border)] text-[var(--nb-text-2)]"}`}>
                      {fmtStatus(inv.status)}
                    </span>
                  </div>
                </ResultRow>
              ))}
            </div>
          )}

          {/* ── Artists ── */}
          {results && results.artists.length > 0 && (
            <div>
              <SectionHeading label="Artists" count={results.artists.length} />
              {results.artists.map((artist, i) => {
                const stylesStr = Array.isArray(artist.styles)
                  ? artist.styles.slice(0, 3).join(", ")
                  : "";
                return (
                  <ResultRow
                    key={artist.id}
                    active={activeIndex === offset("artists") + i}
                    onClick={() => { router.push("/artists"); onClose(); }}
                  >
                    {artist.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={artist.avatar_url}
                        alt={artist.name}
                        className="size-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-xs font-bold text-[#7C3AED] shrink-0">
                        {artist.name[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                        <Highlight text={artist.name} query={query} />
                      </p>
                      {stylesStr && (
                        <p className="text-xs text-[var(--nb-text-2)] truncate">{stylesStr}</p>
                      )}
                    </div>
                  </ResultRow>
                );
              })}
            </div>
          )}

          {hasResults && <div className="h-2" />}
        </div>

        {/* Footer hints */}
        <div className="shrink-0 px-4 py-2 border-t border-[var(--nb-border)] flex items-center gap-4 text-[10px] text-[var(--nb-text-2)]">
          <span className="flex items-center gap-1">
            <kbd className="bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded px-1 py-0.5 font-mono">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded px-1 py-0.5 font-mono">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded px-1 py-0.5 font-mono">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
