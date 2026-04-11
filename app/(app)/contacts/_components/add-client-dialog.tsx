"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type FormFields = {
  name: string;
  email: string;
  phone: string;
  skin_notes: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormFields, string>>;

const EMPTY: FormFields = {
  name: "",
  email: "",
  phone: "",
  skin_notes: "",
  notes: "",
};

export function AddClientDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<FormFields>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setErrors({});
      setServerError(null);
    }
  }, [open]);

  function field(key: keyof FormFields) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      // Clear error on edit
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Enter a valid email address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setServerError("Not authenticated"); setSubmitting(false); return; }

    const { error } = await supabase.from("clients").insert({
      user_id: userId,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      skin_notes: form.skin_notes.trim() || null,
      notes: form.notes.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription className="sr-only">Create a new client record</DialogDescription>
        </DialogHeader>

        <form
          id="add-client-form"
          onSubmit={handleSubmit}
          className="space-y-4 pt-1"
        >
          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">
                Name{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="client-name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={field("name")}
                aria-invalid={!!errors.name}
                autoComplete="off"
                dir="auto"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email">
                Email{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="client-email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={field("email")}
                aria-invalid={!!errors.email}
                autoComplete="off"
                dir="auto"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="client-phone">Phone</Label>
            <Input
              id="client-phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={field("phone")}
              dir="auto"
            />
          </div>

          {/* Skin notes */}
          <div className="space-y-1.5">
            <Label htmlFor="client-skin-notes">Skin Notes</Label>
            <Textarea
              id="client-skin-notes"
              placeholder="Skin type, sensitivities, previous reactions…"
              value={form.skin_notes}
              onChange={field("skin_notes")}
              className="min-h-[72px] resize-none"
              dir="auto"
            />
          </div>

          {/* General notes */}
          <div className="space-y-1.5">
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea
              id="client-notes"
              placeholder="General notes about this client…"
              value={form.notes}
              onChange={field("notes")}
              className="min-h-[88px] resize-none"
              dir="auto"
            />
          </div>

          {/* Server error */}
          {serverError && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="add-client-form"
            disabled={submitting}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? "Adding…" : "Add Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
