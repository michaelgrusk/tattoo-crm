"use client";

import { useState } from "react";

type TattooMark = {
  placement: string | null;
  style: string | null;
  session_date: string | null;
};

type Dot = { cx: number; cy: number };

const FRONT_MAP: Record<string, Dot> = {
  "Head & Face":      { cx: 100, cy: 30  },
  "Neck":             { cx: 100, cy: 55  },
  "Left Shoulder":    { cx: 60,  cy: 80  },
  "Right Shoulder":   { cx: 140, cy: 80  },
  "Left Upper Arm":   { cx: 45,  cy: 110 },
  "Right Upper Arm":  { cx: 155, cy: 110 },
  "Left Forearm":     { cx: 38,  cy: 150 },
  "Right Forearm":    { cx: 162, cy: 150 },
  "Left Hand":        { cx: 32,  cy: 185 },
  "Right Hand":       { cx: 168, cy: 185 },
  "Chest":            { cx: 100, cy: 95  },
  "Sternum":          { cx: 100, cy: 110 },
  "Ribs / Side":      { cx: 75,  cy: 130 },
  "Stomach":          { cx: 100, cy: 145 },
  "Left Hip":         { cx: 75,  cy: 175 },
  "Right Hip":        { cx: 125, cy: 175 },
  "Left Thigh":       { cx: 75,  cy: 220 },
  "Right Thigh":      { cx: 125, cy: 220 },
  "Left Knee":        { cx: 75,  cy: 270 },
  "Right Knee":       { cx: 125, cy: 270 },
  "Left Calf":        { cx: 75,  cy: 320 },
  "Right Calf":       { cx: 125, cy: 320 },
  "Left Ankle":       { cx: 75,  cy: 360 },
  "Right Ankle":      { cx: 125, cy: 360 },
  "Left Foot":        { cx: 72,  cy: 385 },
  "Right Foot":       { cx: 128, cy: 385 },
};

const BACK_MAP: Record<string, Dot> = {
  "Upper Back":           { cx: 100, cy: 95  },
  "Spine":                { cx: 100, cy: 120 },
  "Lower Back":           { cx: 100, cy: 145 },
  "Full Sleeve (Left)":   { cx: 40,  cy: 130 },
  "Full Sleeve (Right)":  { cx: 160, cy: 130 },
  "Left Calf":            { cx: 75,  cy: 320 },
  "Right Calf":           { cx: 125, cy: 320 },
};

type ActiveDot = {
  cx: number;
  cy: number;
  marks: TattooMark[];
};

type TooltipState = {
  cx: number;
  cy: number;
  label: string;
} | null;

function BodySilhouette({ view }: { view: "front" | "back" }) {
  return (
    <g
      fill="none"
      stroke="var(--nb-border)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Head */}
      <ellipse cx="100" cy="27" rx="21" ry="25" />
      {/* Neck */}
      <path d="M91 51 L91 62 L109 62 L109 51" />
      {/* Torso */}
      <path d="M91 62 Q75 60 58 72 L52 102 L50 162 Q54 178 76 181 L100 183 L124 181 Q146 178 150 162 L148 102 L142 72 Q125 60 109 62" />
      {/* Left arm */}
      <path d="M58 72 L38 86 L29 155 L30 192 L42 194 L46 158 L60 96" />
      {/* Right arm */}
      <path d="M142 72 L162 86 L171 155 L170 192 L158 194 L154 158 L140 96" />
      {/* Left leg */}
      <path d="M75 181 L65 206 L63 288 L65 390 L84 390 L85 288 L89 206 L100 183" />
      {/* Right leg */}
      <path d="M125 181 L111 206 L115 288 L116 390 L135 390 L136 288 L137 206 L125 181" />
      {view === "back" && (
        /* Spine line */
        <line x1="100" y1="62" x2="100" y2="181" strokeDasharray="3 3" strokeOpacity="0.4" />
      )}
    </g>
  );
}

function BodyView({
  view,
  placementMap,
  tattoos,
}: {
  view: "front" | "back";
  placementMap: Record<string, Dot>;
  tattoos: TattooMark[];
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  // Group active tattoos by placement dot
  const activeDots: Record<string, ActiveDot> = {};
  for (const t of tattoos) {
    if (!t.placement) continue;
    const dot = placementMap[t.placement];
    if (!dot) continue;
    const key = `${dot.cx},${dot.cy}`;
    if (!activeDots[key]) activeDots[key] = { cx: dot.cx, cy: dot.cy, marks: [] };
    activeDots[key].marks.push(t);
  }

  const label = view === "front" ? "Front" : "Back";

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--nb-text-2)]">{label}</p>
      <div className="relative">
        <svg
          viewBox="0 0 200 400"
          width="120"
          height="240"
          className="overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          <BodySilhouette view={view} />

          {/* Inactive dots (ghost) */}
          {Object.entries(placementMap).map(([placement, { cx, cy }]) => {
            const key = `${cx},${cy}`;
            if (activeDots[key]) return null;
            return (
              <circle
                key={placement}
                cx={cx}
                cy={cy}
                r={5}
                fill="var(--nb-border)"
                opacity={0.3}
              />
            );
          })}

          {/* Active dots */}
          {Object.entries(activeDots).map(([key, { cx, cy, marks }]) => {
            const tooltipLabel = marks
              .map((m) => {
                const parts = [m.style].filter(Boolean);
                if (m.session_date) {
                  parts.push(
                    new Date(m.session_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  );
                }
                return parts.join(" · ");
              })
              .join(", ");

            const hasMultiple = marks.length > 1;

            return (
              <g key={key}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={hasMultiple ? 7 : 6}
                  fill="#7C3AED"
                  opacity={0.9}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() =>
                    setTooltip({ cx, cy, label: tooltipLabel })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
                {hasMultiple && (
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="700"
                    fill="white"
                    style={{ pointerEvents: "none" }}
                  >
                    {marks.length}
                  </text>
                )}
                {/* Pulse ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={hasMultiple ? 10 : 9}
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="1"
                  opacity={0.3}
                />
              </g>
            );
          })}

          {/* SVG tooltip */}
          {tooltip && (() => {
            const maxWidth = 90;
            const tipX = Math.max(maxWidth / 2 + 2, Math.min(197 - maxWidth / 2, tooltip.cx));
            const tipY = tooltip.cy - 14;
            return (
              <g>
                <rect
                  x={tipX - maxWidth / 2}
                  y={tipY - 20}
                  width={maxWidth}
                  height={20}
                  rx={4}
                  fill="#1E1B4B"
                  opacity={0.92}
                />
                <text
                  x={tipX}
                  y={tipY - 7}
                  textAnchor="middle"
                  fontSize="8"
                  fill="white"
                  fontWeight="500"
                  style={{ pointerEvents: "none" }}
                >
                  {tooltip.label.length > 22 ? tooltip.label.slice(0, 20) + "…" : tooltip.label}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

export function BodyMap({ tattoos }: { tattoos: TattooMark[] }) {
  const hasAny = tattoos.some((t) => t.placement && (FRONT_MAP[t.placement] || BACK_MAP[t.placement]));

  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-4">
      <p className="text-xs font-semibold text-[var(--nb-text)] uppercase tracking-wide mb-4">
        Body Map
      </p>
      {!hasAny ? (
        <p className="text-xs text-[var(--nb-text-2)] text-center py-4">
          No placements logged yet
        </p>
      ) : (
        <div className="flex items-start justify-center gap-10">
          <BodyView view="front" placementMap={FRONT_MAP} tattoos={tattoos} />
          <BodyView view="back" placementMap={BACK_MAP} tattoos={tattoos} />
        </div>
      )}
    </div>
  );
}
