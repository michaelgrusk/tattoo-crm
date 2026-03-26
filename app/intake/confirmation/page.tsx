import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; style?: string; hasImage?: string }>;
}) {
  const { name, style, hasImage } = await searchParams;

  return (
    <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-center px-4 py-10">
      {/* Card */}
      <div className="w-full max-w-md bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-10 flex flex-col items-center text-center">
        {/* Success icon */}
        <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>

        <h1 className="text-2xl font-semibold text-[var(--nb-text)] mb-2">
          {name ? `Thanks, ${name}!` : "Request received!"}
        </h1>
        <p className="text-sm text-[var(--nb-text-2)] leading-relaxed mb-8">
          We&apos;ve got your tattoo request and will review it shortly.
          Expect to hear from us within 1–2 business days.
        </p>

        {/* Summary card */}
        <div className="w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-5 py-4 text-left space-y-2 mb-8">
          <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-3">
            What you submitted
          </p>
          {style && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--nb-text-2)]">Style</span>
              <span className="font-medium text-[var(--nb-text)]">{style}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--nb-text-2)]">Reference image</span>
            <span className="font-medium text-[var(--nb-text)]">
              {hasImage === "1" ? "Included" : "Not included"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--nb-text-2)]">Status</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
              <span className="size-1.5 rounded-full bg-sky-400" />
              New request
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 w-full">
          <Link
            href="/intake"
            className="w-full py-2.5 rounded-xl border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] bg-[var(--nb-card)] hover:bg-[var(--nb-bg)] transition-colors text-center"
          >
            Submit another request
          </Link>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="size-6 rounded-lg bg-[#7C3AED] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <span className="text-xs text-[var(--nb-text-2)] font-medium">Needlebook</span>
      </div>
    </div>
  );
}
