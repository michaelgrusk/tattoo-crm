"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { WaiverField, WaiverSection, FieldType } from "../../../types";

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { msg: string; type: "success" | "error" } | null;

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-200 ${
        toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle2 size={16} className="shrink-0" />
      ) : (
        <AlertCircle size={16} className="shrink-0" />
      )}
      {toast.msg}
    </div>
  );
}

// ─── Field type options ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  paragraph: "Paragraph",
  yesno: "Yes / No",
  checkbox: "Checkbox",
  date: "Date",
};

// ─── Add field form ───────────────────────────────────────────────────────────

function AddFieldForm({
  onAdd,
  onCancel,
}: {
  onAdd: (field: WaiverField) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [hasFollowUp, setHasFollowUp] = useState(false);
  const [followUpLabel, setFollowUpLabel] = useState("Please provide details");

  function handleAdd() {
    if (!label.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      label: label.trim(),
      type,
      required,
      hasFollowUp: type === "yesno" && hasFollowUp ? true : undefined,
      followUpLabel: type === "yesno" && hasFollowUp ? followUpLabel : undefined,
    });
  }

  return (
    <div className="mt-2 rounded-xl border border-[#7C3AED]/25 bg-[var(--nb-active-bg)] p-4 space-y-3">
      {/* Label */}
      <div>
        <label className="block text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1.5">
          Question text
        </label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Enter your question..."
          className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)]"
        />
      </div>

      {/* Type picker */}
      <div>
        <label className="block text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1.5">
          Answer type
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === t
                  ? "bg-[#7C3AED] text-white"
                  : "bg-[var(--nb-card)] border border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-5 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-[var(--nb-text-2)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded accent-[#7C3AED]"
          />
          Required
        </label>
        {type === "yesno" && (
          <label className="flex items-center gap-2 text-sm text-[var(--nb-text-2)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasFollowUp}
              onChange={(e) => setHasFollowUp(e.target.checked)}
              className="rounded accent-[#7C3AED]"
            />
            Include follow-up text field
          </label>
        )}
      </div>

      {/* Follow-up label */}
      {type === "yesno" && hasFollowUp && (
        <div>
          <label className="block text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1.5">
            Follow-up label
          </label>
          <input
            value={followUpLabel}
            onChange={(e) => setFollowUpLabel(e.target.value)}
            className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleAdd}
          disabled={!label.trim()}
          className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Add Question
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onChange,
  onDelete,
}: {
  field: WaiverField;
  isOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onChange: (updated: WaiverField) => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
          isOver
            ? "border-[#7C3AED] bg-[var(--nb-active-bg)] scale-[0.99]"
            : "border-[var(--nb-border)] bg-[var(--nb-bg)] hover:border-[#7C3AED]/30"
        }`}
      >
        {/* Drag handle */}
        <GripVertical
          size={14}
          className="text-[var(--nb-text-2)] cursor-grab active:cursor-grabbing shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
        />

        {/* Label (inline editable) */}
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="flex-1 min-w-0 text-sm text-[var(--nb-text)] bg-transparent outline-none placeholder:text-[var(--nb-text-2)]"
          placeholder="Question label"
        />

        {/* Type selector */}
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as FieldType })}
          className="text-[11px] font-medium text-[var(--nb-text-2)] bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-md px-2 py-1 outline-none cursor-pointer shrink-0"
        >
          {(Object.entries(TYPE_LABELS) as [FieldType, string][]).map(([val, lbl]) => (
            <option key={val} value={val}>
              {lbl}
            </option>
          ))}
        </select>

        {/* Follow-up toggle (yesno only) */}
        {field.type === "yesno" && (
          <button
            onClick={() => onChange({ ...field, hasFollowUp: !field.hasFollowUp })}
            title={field.hasFollowUp ? "Remove follow-up text" : "Add follow-up text"}
            className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors shrink-0 ${
              field.hasFollowUp
                ? "bg-[var(--nb-active-bg)] text-[var(--nb-active-text)] border-transparent"
                : "text-[var(--nb-text-2)] border-[var(--nb-border)] hover:border-[#7C3AED]/40"
            }`}
          >
            +text
          </button>
        )}

        {/* Required toggle */}
        <button
          onClick={() => onChange({ ...field, required: !field.required })}
          className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors shrink-0 ${
            field.required
              ? "bg-[var(--nb-active-bg)] text-[var(--nb-active-text)] border-transparent"
              : "text-[var(--nb-text-2)] border-[var(--nb-border)]"
          }`}
        >
          {field.required ? "Required" : "Optional"}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="text-[var(--nb-text-2)] hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
          title="Remove question"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Follow-up label input (indented) */}
      {field.hasFollowUp && (
        <div className="ml-8 mt-1 flex items-center gap-2">
          <span className="text-[11px] text-[var(--nb-text-2)]">↳</span>
          <input
            value={field.followUpLabel ?? ""}
            onChange={(e) => onChange({ ...field, followUpLabel: e.target.value })}
            placeholder="Follow-up question label"
            className="flex-1 text-xs text-[var(--nb-text-2)] bg-transparent outline-none border-b border-dashed border-[var(--nb-border)] py-0.5 focus:border-[#7C3AED] transition-colors"
          />
        </div>
      )}
    </div>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  dragOverFieldId,
  onUpdate,
  onDelete,
  onFieldDragStart,
  onFieldDragOver,
  onFieldDrop,
  onFieldDragEnd,
}: {
  section: WaiverSection;
  dragOverFieldId: string | null;
  onUpdate: (s: WaiverSection) => void;
  onDelete: () => void;
  onFieldDragStart: (fieldId: string, sectionId: string) => void;
  onFieldDragOver: (e: React.DragEvent, fieldId: string) => void;
  onFieldDrop: (fieldId: string, sectionId: string) => void;
  onFieldDragEnd: () => void;
}) {
  const [addingField, setAddingField] = useState(false);

  function changeField(fieldId: string, updated: WaiverField) {
    onUpdate({
      ...section,
      fields: section.fields.map((f) => (f.id === fieldId ? updated : f)),
    });
  }

  function removeField(fieldId: string) {
    onUpdate({ ...section, fields: section.fields.filter((f) => f.id !== fieldId) });
  }

  function addField(field: WaiverField) {
    onUpdate({ ...section, fields: [...section.fields, field] });
    setAddingField(false);
  }

  return (
    <div className="bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--nb-border)]">
        <input
          value={section.title}
          onChange={(e) => onUpdate({ ...section, title: e.target.value })}
          className="flex-1 text-sm font-semibold text-[var(--nb-text)] bg-transparent outline-none placeholder:text-[var(--nb-text-2)]"
          placeholder="Section title"
        />
        <button
          onClick={onDelete}
          className="text-[var(--nb-text-2)] hover:text-red-500 transition-colors"
          title="Delete section"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="px-5 py-4 space-y-2">
        {section.fields.length === 0 && (
          <p className="text-sm text-[var(--nb-text-2)] text-center py-3">
            No questions yet — add one below
          </p>
        )}
        {section.fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            isOver={dragOverFieldId === field.id}
            onDragStart={() => onFieldDragStart(field.id, section.id)}
            onDragOver={(e) => onFieldDragOver(e, field.id)}
            onDrop={() => onFieldDrop(field.id, section.id)}
            onDragEnd={onFieldDragEnd}
            onChange={(updated) => changeField(field.id, updated)}
            onDelete={() => removeField(field.id)}
          />
        ))}
      </div>

      {/* Add question */}
      <div className="px-5 pb-4">
        {addingField ? (
          <AddFieldForm onAdd={addField} onCancel={() => setAddingField(false)} />
        ) : (
          <button
            onClick={() => setAddingField(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
          >
            <Plus size={14} />
            Add question
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function WaiverBuilder({
  templateId,
  initialName,
  initialSections,
}: {
  templateId: number | null;
  initialName: string;
  initialSections: WaiverSection[];
}) {
  const router = useRouter();
  const [templateName, setTemplateName] = useState(initialName);
  const [sections, setSections] = useState<WaiverSection[]>(initialSections);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  // Drag state
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);

  // Add section state
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Section operations ────────────────────────────────────────────

  function updateSection(updated: WaiverSection) {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function deleteSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }

  function addSection() {
    if (!newSectionTitle.trim()) return;
    setSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: newSectionTitle.trim(), fields: [] },
    ]);
    setNewSectionTitle("");
    setAddingSection(false);
  }

  // ── Drag & drop ───────────────────────────────────────────────────

  function handleFieldDragStart(fieldId: string, sectionId: string) {
    setDragFieldId(fieldId);
    setDragSectionId(sectionId);
  }

  function handleFieldDragOver(e: React.DragEvent, fieldId: string) {
    e.preventDefault();
    setDragOverFieldId(fieldId);
  }

  function handleFieldDrop(targetFieldId: string, targetSectionId: string) {
    if (!dragFieldId || dragSectionId !== targetSectionId) {
      setDragFieldId(null);
      setDragOverFieldId(null);
      setDragSectionId(null);
      return;
    }
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== targetSectionId) return s;
        const fields = [...s.fields];
        const fromIdx = fields.findIndex((f) => f.id === dragFieldId);
        const toIdx = fields.findIndex((f) => f.id === targetFieldId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s;
        fields.splice(toIdx, 0, fields.splice(fromIdx, 1)[0]);
        return { ...s, fields };
      })
    );
    setDragFieldId(null);
    setDragOverFieldId(null);
    setDragSectionId(null);
  }

  function handleFieldDragEnd() {
    setDragFieldId(null);
    setDragOverFieldId(null);
    setDragSectionId(null);
  }

  // ── Save ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (!templateName.trim()) {
      showToast("Template name is required", "error");
      return;
    }
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showToast("Not authenticated", "error");
      setSaving(false);
      return;
    }

    if (templateId === null) {
      const { data, error } = await supabase
        .from("waiver_templates")
        .insert({ name: templateName.trim(), sections, user_id: user.id })
        .select("id")
        .single();

      if (error || !data) {
        showToast(error?.message ?? "Failed to create template", "error");
        setSaving(false);
        return;
      }
      showToast("Template created!");
      router.replace(`/waivers/builder/${data.id}`);
    } else {
      const { error } = await supabase
        .from("waiver_templates")
        .update({ name: templateName.trim(), sections })
        .eq("id", templateId);

      if (error) {
        showToast(error.message, "error");
      } else {
        showToast("Template saved!");
      }
    }

    setSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-[var(--nb-bg)] border-b border-[var(--nb-border)] px-8 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push("/waivers")}
          className="flex items-center gap-1.5 text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors"
        >
          <ArrowLeft size={15} />
          Waivers
        </button>

        <div className="flex-1 mx-2">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name…"
            className="w-full max-w-sm text-sm font-semibold text-[var(--nb-text)] bg-transparent outline-none placeholder:text-[var(--nb-text-2)] border-b border-transparent focus:border-[var(--nb-border)] pb-0.5 transition-colors"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving…" : "Save Template"}
        </button>
      </div>

      {/* Builder body */}
      <div className="p-8 max-w-2xl space-y-5">
        {sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            dragOverFieldId={dragOverFieldId}
            onUpdate={updateSection}
            onDelete={() => deleteSection(section.id)}
            onFieldDragStart={handleFieldDragStart}
            onFieldDragOver={handleFieldDragOver}
            onFieldDrop={handleFieldDrop}
            onFieldDragEnd={handleFieldDragEnd}
          />
        ))}

        {/* Add section */}
        {addingSection ? (
          <div className="bg-[var(--nb-card)] rounded-2xl border border-[#7C3AED]/25 p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--nb-text)]">New section</p>
            <input
              autoFocus
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSection();
                if (e.key === "Escape") setAddingSection(false);
              }}
              placeholder="Section title (e.g. Medical History)"
              className="w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-2.5 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)]"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={addSection}
                disabled={!newSectionTitle.trim()}
                className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Add Section
              </button>
              <button
                onClick={() => setAddingSection(false)}
                className="px-4 py-2 rounded-lg border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className="flex items-center gap-2 w-full px-5 py-3.5 rounded-2xl border border-dashed border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] hover:border-[#7C3AED]/40 hover:text-[#7C3AED] transition-colors"
          >
            <Plus size={15} />
            Add section
          </button>
        )}
      </div>

      <Toast toast={toast} />
    </>
  );
}
