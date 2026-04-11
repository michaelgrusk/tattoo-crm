"use client";

import { useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function StarPicker({
  value,
  onChange,
  accent,
}: {
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill={active >= star ? accent : "none"}
            stroke={active >= star ? accent : "rgba(255,255,255,0.2)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({
  studioName,
  avatarUrl,
  accent,
  studioUserId,
}: {
  studioName: string;
  avatarUrl: string | null;
  accent: string;
  studioUserId: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: dbError } = await supabase.from("reviews").insert({
      user_id: studioUserId,
      rating,
      comment: comment.trim() || null,
      reviewer_name: isAnonymous ? null : reviewerName.trim() || null,
      is_anonymous: isAnonymous,
      is_displayed: false,
      source: "review_link",
    });

    setSubmitting(false);
    if (dbError) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F0F16] flex items-center justify-center p-5">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-5">✨</div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Thank you for your review!
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Your feedback means a lot and helps other clients find the right artist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F16] text-white relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-72 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${accent}55 0%, transparent 70%)`,
        }}
      />

      <div className="relative mx-auto max-w-lg px-5 py-14 sm:py-20">
        {/* Studio header */}
        <div className="flex flex-col items-center text-center mb-10">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={studioName}
              width={80}
              height={80}
              className="size-20 rounded-full object-cover ring-4 ring-white/10 mb-4"
              unoptimized
            />
          ) : (
            <div
              className="size-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ring-4 ring-white/10 mb-4"
              style={{ backgroundColor: accent }}
            >
              {studioName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">{studioName}</h1>
          <p className="text-white/50 text-sm mt-1">Leave a review</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Stars */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
            <label className="block text-sm font-medium text-white/60 mb-4">
              Your rating <span style={{ color: accent }}>*</span>
            </label>
            <StarPicker value={rating} onChange={setRating} accent={accent} />
            <div className="h-5 mt-2">
              {rating > 0 && (
                <p className="text-xs text-white/40">{STAR_LABELS[rating]}</p>
              )}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Your experience{" "}
              <span className="text-xs font-normal text-white/30">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Share your experience..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors resize-none"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Your name{" "}
              <span className="text-xs font-normal text-white/30">(optional)</span>
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              disabled={isAnonymous}
              placeholder="Your name (optional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors disabled:opacity-40"
            />
          </div>

          {/* Anonymous toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <button
              type="button"
              role="checkbox"
              aria-checked={isAnonymous}
              onClick={() => setIsAnonymous((v) => !v)}
              className={`size-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                isAnonymous
                  ? "border-[#7C3AED] bg-[#7C3AED]"
                  : "border-white/20 bg-white/5"
              }`}
            >
              {isAnonymous && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
              Post anonymously
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-lg"
            style={{ backgroundColor: accent }}
          >
            {submitting && (
              <svg
                className="animate-spin size-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            )}
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <a
            href="https://needlebook.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/20 hover:text-white/40 transition-colors"
          >
            Powered by Tatflow
          </a>
        </div>
      </div>
    </div>
  );
}
