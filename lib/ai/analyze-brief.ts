export type AiBriefAnalysis = {
  effort_score: number;        // 1–10
  fit_score: number;           // 1–10
  overall_rating: "Great fit" | "Good fit" | "Needs more info" | "Low effort";
  session_length: "1-2 hours" | "2-3 hours" | "2-4 hours" | "4-8 hours" | "Multiple sessions";
  recommended_style: string;
  suggested_artist: string | null;
  structured_brief: string;
  red_flags: string[];
  suggested_questions: string[];
};

const RECOGNIZED_STYLES = new Set([
  "Blackwork", "Japanese", "Fine line", "Watercolor", "Geometric",
  "Traditional", "Realism", "Neo-traditional", "Tribal", "Portrait", "Anime", "Other",
]);

const PLACEMENT_KEYWORDS = [
  "arm", "forearm", "upper arm", "wrist", "hand", "finger",
  "back", "chest", "shoulder", "neck", "throat",
  "leg", "thigh", "calf", "ankle", "foot", "shin",
  "rib", "stomach", "hip", "behind ear", "collarbone",
];

const SMALL_KEYWORDS = ["small", "tiny", "simple", "minimal", "wrist", "finger", "ankle", "behind ear"];
const MEDIUM_KEYWORDS = ["medium", "shoulder", "calf", "forearm", "palm"];
const LARGE_KEYWORDS = ["large", "back", "chest", "thigh", "sleeve", "half sleeve", "rib", "stomach"];
const MULTI_KEYWORDS = ["full sleeve", "full back", "bodysuit", "multiple sessions", "both", "full leg", "full arm"];

const RED_FLAG_PRICE_WORDS = ["cheap", "free", "budget", "discount", "cheapest"];

export function analyzeBrief(input: {
  client_name: string;
  description: string;
  style?: string | null;
  placement?: string | null;
  size?: string | null;
  preferred_date?: string | null;
  has_reference_image?: boolean;
  has_instagram?: boolean;
  has_phone?: boolean;
  artists?: { name: string }[];
  flash_piece_title?: string | null;
}): AiBriefAnalysis {
  const isFlash = !!input.flash_piece_title;

  // ── Flash booking — simplified path ──────────────────────────────────────
  if (isFlash) {
    const placement = (input.placement ?? "").trim();
    const preferredDate = (input.preferred_date ?? "").trim();
    const hasInstagram = !!input.has_instagram;
    const hasPhone = !!input.has_phone;

    // Effort: client already chose a specific design — strong signal
    let effortScore = 8;
    if (placement) effortScore += 0.5;
    if (preferredDate) effortScore += 0.5;
    if (hasInstagram || hasPhone) effortScore += 1;
    effortScore = Math.min(10, Math.round(effortScore));

    // Fit: concrete booking intent
    let fitScore = 7;
    if (placement) fitScore += 1;
    if (preferredDate) {
      const d = new Date(preferredDate + "T00:00:00");
      if (!isNaN(d.getTime()) && d > new Date()) fitScore += 1;
    }
    if (hasPhone || hasInstagram) fitScore += 1;
    fitScore = Math.min(10, Math.round(fitScore));

    const combined = effortScore + fitScore;
    const overall_rating: AiBriefAnalysis["overall_rating"] = combined >= 16 ? "Great fit" : "Good fit";

    const briefParts = [`Flash booking — ${input.flash_piece_title}.`];
    if (placement) briefParts.push(`Placement: ${placement}.`);
    if (preferredDate) {
      const d = new Date(preferredDate + "T00:00:00");
      if (!isNaN(d.getTime())) {
        briefParts.push(`Preferred date: ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`);
      }
    }

    return {
      effort_score: effortScore,
      fit_score: fitScore,
      overall_rating,
      session_length: "1-2 hours",
      recommended_style: "Flash",
      suggested_artist: input.artists && input.artists.length > 0 ? input.artists[0].name : null,
      structured_brief: briefParts.join(" "),
      red_flags: [],
      suggested_questions: [],
    };
  }

  const desc = (input.description ?? "").trim();
  const descLower = desc.toLowerCase();
  const style = (input.style ?? "").trim();
  const placement = (input.placement ?? "").trim();
  const placementLower = placement.toLowerCase();
  const size = (input.size ?? "").trim();
  const sizeLower = size.toLowerCase();
  const hasRefImage = !!input.has_reference_image;
  const hasInstagram = !!input.has_instagram;
  const hasPhone = !!input.has_phone;
  const preferredDate = (input.preferred_date ?? "").trim();
  const combinedText = `${descLower} ${placementLower} ${sizeLower}`;

  // ── Effort score ──────────────────────────────────────────────────────────

  let effortScore = 2; // baseline
  if (desc.length > 50) effortScore += 2;
  if (desc.length > 150) effortScore += 1;
  if (style && RECOGNIZED_STYLES.has(style)) effortScore += 1;
  if (placement) effortScore += 1;
  if (size) effortScore += 1;
  if (preferredDate) effortScore += 1;
  if (hasRefImage) effortScore += 2;
  if (hasInstagram) effortScore += 0.5;
  if (hasPhone) effortScore += 0.5;
  effortScore = Math.min(10, Math.round(effortScore));

  // ── Fit score ─────────────────────────────────────────────────────────────

  let fitScore = 1; // baseline
  if (style && RECOGNIZED_STYLES.has(style)) fitScore += 2;
  if (PLACEMENT_KEYWORDS.some((kw) => combinedText.includes(kw))) fitScore += 1;
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 4) fitScore += 1;
  if (hasRefImage) fitScore += 2;
  if (preferredDate) {
    const d = new Date(preferredDate + "T00:00:00");
    if (!isNaN(d.getTime()) && d > new Date()) fitScore += 1;
  }
  if (hasPhone || hasInstagram) fitScore += 1;
  if (!RED_FLAG_PRICE_WORDS.some((w) => descLower.includes(w))) fitScore += 1;
  fitScore = Math.min(10, Math.round(fitScore));

  // ── Overall rating ────────────────────────────────────────────────────────

  const combined = effortScore + fitScore;
  let overall_rating: AiBriefAnalysis["overall_rating"];
  if (combined >= 14) overall_rating = "Great fit";
  else if (combined >= 10) overall_rating = "Good fit";
  else if (combined >= 6) overall_rating = "Needs more info";
  else overall_rating = "Low effort";

  // ── Session length ────────────────────────────────────────────────────────

  let session_length: AiBriefAnalysis["session_length"] = "2-3 hours";
  if (MULTI_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    session_length = "Multiple sessions";
  } else if (LARGE_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    session_length = "4-8 hours";
  } else if (MEDIUM_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    session_length = "2-4 hours";
  } else if (SMALL_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    session_length = "1-2 hours";
  }

  // ── Recommended style ─────────────────────────────────────────────────────

  const recommended_style = RECOGNIZED_STYLES.has(style) ? style : style || "Not specified";

  // ── Suggested artist ──────────────────────────────────────────────────────

  const suggested_artist: string | null =
    input.artists && input.artists.length > 0 ? input.artists[0].name : null;

  // ── Structured brief ──────────────────────────────────────────────────────

  const parts: string[] = [];
  const clientPart = `${input.client_name} is requesting`;
  const stylePart = RECOGNIZED_STYLES.has(style) ? `a ${style} tattoo` : "a tattoo";
  const placementPart = placement ? ` on their ${placement}` : "";
  parts.push(`${clientPart} ${stylePart}${placementPart}.`);
  if (desc) parts.push(desc.endsWith(".") ? desc : `${desc}.`);
  if (size) parts.push(`Estimated size: ${size}.`);
  if (preferredDate) {
    const d = new Date(preferredDate + "T00:00:00");
    if (!isNaN(d.getTime())) {
      parts.push(`Preferred date: ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`);
    }
  }
  const structured_brief = parts.join(" ");

  // ── Red flags ─────────────────────────────────────────────────────────────

  const red_flags: string[] = [];
  if (desc.length < 10) red_flags.push("Very brief description — ask for more details");
  if (!style || !RECOGNIZED_STYLES.has(style)) red_flags.push("No style specified");
  if (!placement) red_flags.push("No placement specified");
  if (!hasPhone && !hasInstagram) red_flags.push("No contact method provided");
  if (RED_FLAG_PRICE_WORDS.some((w) => descLower.includes(w))) {
    red_flags.push("Client mentioned price sensitivity");
  }

  // ── Suggested questions ───────────────────────────────────────────────────

  const suggested_questions: string[] = [];
  if (!style || !RECOGNIZED_STYLES.has(style)) {
    suggested_questions.push("What tattoo style are you interested in? (e.g. blackwork, Japanese, fine line)");
  }
  if (!placement) {
    suggested_questions.push("Where on your body would you like this tattoo?");
  }
  if (!size) {
    suggested_questions.push("What size are you thinking? (e.g. palm-sized, forearm length)");
  }
  if (!hasRefImage) {
    suggested_questions.push("Do you have any reference images or inspiration you can share?");
  }
  if (wordCount < 4) {
    suggested_questions.push("Can you describe your idea in more detail?");
  }

  return {
    effort_score: effortScore,
    fit_score: fitScore,
    overall_rating,
    session_length,
    recommended_style,
    suggested_artist,
    structured_brief,
    red_flags,
    suggested_questions,
  };
}
