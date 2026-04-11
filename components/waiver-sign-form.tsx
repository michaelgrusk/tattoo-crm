"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import type { WaiverTemplate, WaiverSection, WaiverField } from "@/app/(app)/waivers/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WaiverSignFormProps = {
  template: WaiverTemplate;
  userId: string;
  /** If true, renders with a dark background (in-studio modal). Otherwise light. */
  darkMode?: boolean;
  onSuccess?: () => void;
};

// ─── Age helper ────────────────────────────────────────────────────────────────

function isUnder18(dateStr: string) {
  if (!dateStr) return false;
  const dob = new Date(dateStr);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    return age - 1 < 18;
  }
  return age < 18;
}

// ─── Canvas signature ──────────────────────────────────────────────────────────

function SignatureCanvas({
  onCapture,
}: {
  onCapture: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  function getPos(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if ("touches" in e) {
      const t = e.touches[0];
      return {
        x: (t.clientX - rect.left) * dpr,
        y: (t.clientY - rect.top) * dpr,
      };
    }
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  }

  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }

  useEffect(() => {
    initCanvas();
    window.addEventListener("resize", initCanvas);
    return () => window.removeEventListener("resize", initCanvas);
  }, []);

  function startDraw(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x / (window.devicePixelRatio || 1), pos.y / (window.devicePixelRatio || 1));
  }

  function draw(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x / dpr, pos.y / dpr);
    ctx.stroke();
    hasDrawn.current = true;
    onCapture(canvas.toDataURL("image/png"));
  }

  function endDraw() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onCapture(null);
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-32 rounded-xl border-2 border-gray-200 bg-white cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <button
        type="button"
        onClick={clear}
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
      >
        <RotateCcw size={11} />
        Clear
      </button>
      <p className="text-xs text-gray-400 mt-1.5 text-center">
        Sign with your mouse or finger
      </p>
    </div>
  );
}

// ─── Field renderer ────────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: WaiverField;
  value: string | boolean | undefined;
  onChange: (val: string | boolean) => void;
  error?: string;
}) {
  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors placeholder:text-gray-400";
  const errorClass = "mt-1 text-xs text-red-500";

  if (field.type === "text") {
    return (
      <>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
          className={inputClass}
          aria-invalid={!!error}
          dir="auto"
        />
        {error && <p className={errorClass}>{error}</p>}
      </>
    );
  }

  if (field.type === "paragraph") {
    return (
      <>
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
          rows={3}
          className={`${inputClass} resize-none`}
          aria-invalid={!!error}
          dir="auto"
        />
        {error && <p className={errorClass}>{error}</p>}
      </>
    );
  }

  if (field.type === "date") {
    return (
      <>
        <input
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          aria-invalid={!!error}
        />
        {error && <p className={errorClass}>{error}</p>}
      </>
    );
  }

  if (field.type === "yesno") {
    const isYes = value === true || value === "yes";
    const isNo = value === false || value === "no";
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange("yes")}
            className={`px-5 py-2 rounded-xl text-sm font-medium border transition-colors ${
              isYes
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange("no")}
            className={`px-5 py-2 rounded-xl text-sm font-medium border transition-colors ${
              isNo
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            No
          </button>
        </div>
        {error && <p className={errorClass}>{error}</p>}
      </>
    );
  }

  if (field.type === "checkbox") {
    return (
      <>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div
            className={`mt-0.5 shrink-0 size-5 rounded-md border-2 flex items-center justify-center transition-colors ${
              value
                ? "bg-violet-600 border-violet-600"
                : "bg-white border-gray-300 group-hover:border-violet-400"
            }`}
            onClick={() => onChange(!value)}
          >
            {value && (
              <svg
                viewBox="0 0 10 8"
                fill="none"
                className="w-3 h-3 text-white"
              >
                <path
                  d="M1 4L3.5 6.5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <span className="text-sm text-gray-700 leading-snug">{field.label}</span>
        </label>
        {error && <p className={errorClass}>{error}</p>}
      </>
    );
  }

  return null;
}

// ─── Main form ─────────────────────────────────────────────────────────────────

export function WaiverSignForm({ template, userId, onSuccess }: WaiverSignFormProps) {
  // Collect all fields flat (for validation)
  const allFields = template.sections.flatMap((s: WaiverSection) => s.fields);

  const [responses, setResponses] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sigTab, setSigTab] = useState<"draw" | "type">("draw");
  const [drawnSig, setDrawnSig] = useState<string | null>(null);
  const [typedSig, setTypedSig] = useState("");
  const [sigError, setSigError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  function setResponse(fieldId: string, val: string | boolean) {
    setResponses((prev) => ({ ...prev, [fieldId]: val }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: "" }));
  }

  // DOB field id
  const dobField = allFields.find((f) => f.type === "date" && f.id === "f-dob");
  const dobValue = dobField ? String(responses[dobField.id] ?? "") : "";
  const ageWarning = dobValue ? isUnder18(dobValue) : false;

  function validate() {
    const errs: Record<string, string> = {};

    for (const field of allFields) {
      const val = responses[field.id];
      if (field.required) {
        if (field.type === "checkbox" && !val) {
          errs[field.id] = "You must check this box";
        } else if (
          (field.type === "text" || field.type === "paragraph" || field.type === "date") &&
          !String(val ?? "").trim()
        ) {
          errs[field.id] = "This field is required";
        } else if (field.type === "yesno" && val === undefined) {
          errs[field.id] = "Please select Yes or No";
        }
      }
    }

    setErrors(errs);

    // Signature
    const hasSig =
      sigTab === "draw" ? !!drawnSig : typedSig.trim().length > 0;
    if (!hasSig) {
      setSigError("Signature is required");
      return false;
    }
    setSigError("");

    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    const signatureType = sigTab;
    const signatureData =
      sigTab === "draw" ? drawnSig : typedSig.trim();

    const res = await fetch("/api/submit-waiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: template.id,
        user_id: userId,
        client_name:
          String(responses["f-name"] ?? "").trim() || "Unknown",
        client_email: String(responses["f-email"] ?? "").trim() || null,
        responses,
        signature_type: signatureType,
        signature_data: signatureData,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Submission failed. Please try again.");
      return;
    }

    setSuccess(true);
    onSuccess?.();
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          Waiver submitted!
        </h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Thank you. Your signed waiver has been received.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Sections */}
      {template.sections.map((section: WaiverSection) => (
        <div key={section.id}>
          <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {section.title}
          </h2>

          <div className="space-y-5">
            {section.fields.map((field: WaiverField) => (
              <div key={field.id}>
                {field.type !== "checkbox" && (
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </label>
                )}
                <FieldInput
                  field={field}
                  value={responses[field.id]}
                  onChange={(val) => setResponse(field.id, val)}
                  error={errors[field.id]}
                />

                {/* DOB age warning */}
                {field.id === "f-dob" && ageWarning && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    You must be 18 or older to receive a tattoo. A
                    parent/guardian must sign this waiver on your behalf.
                  </div>
                )}

                {/* Follow-up (yesno) */}
                {field.type === "yesno" &&
                  field.hasFollowUp &&
                  (responses[field.id] === "yes" ||
                    responses[field.id] === true) && (
                    <div className="mt-3 pl-4 border-l-2 border-violet-200">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        {field.followUpLabel ?? "Please describe"}
                      </label>
                      <textarea
                        value={String(
                          responses[field.id + "_followup"] ?? ""
                        )}
                        onChange={(e) =>
                          setResponse(field.id + "_followup", e.target.value)
                        }
                        rows={2}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none placeholder:text-gray-400"
                        placeholder="Type your answer…"
                      />
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Signature */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
          Signature
        </h2>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
          {(["draw", "type"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSigTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sigTab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "draw" ? "Draw" : "Type"}
            </button>
          ))}
        </div>

        {sigTab === "draw" ? (
          <SignatureCanvas onCapture={setDrawnSig} />
        ) : (
          <div>
            <input
              type="text"
              value={typedSig}
              onChange={(e) => {
                setTypedSig(e.target.value);
                if (sigError) setSigError("");
              }}
              placeholder="Type your full name"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-lg text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 italic font-serif placeholder:text-gray-400 placeholder:not-italic placeholder:font-sans"
            />
            {typedSig && (
              <p className="text-xs text-gray-400 mt-1.5">
                Typed signatures are legally binding.
              </p>
            )}
          </div>
        )}

        {sigError && (
          <p className="mt-2 text-xs text-red-500">{sigError}</p>
        )}
      </div>

      {/* Submit */}
      {submitError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Waiver"}
      </button>
    </form>
  );
}
