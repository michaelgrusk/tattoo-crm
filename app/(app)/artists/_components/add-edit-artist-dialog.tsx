"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import type { Artist } from "../page";

const TATTOO_STYLES = [
  "Blackwork",
  "Japanese",
  "Fine line",
  "Watercolor",
  "Geometric",
  "Traditional",
  "Realism",
  "Neo-traditional",
  "Tribal",
  "Portrait",
];

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)]";

type FormState = {
  name: string;
  bio: string;
  styles: string[];
  yearsExp: string;
  instagram: string;
  email: string;
  phone: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  bio: "",
  styles: [],
  yearsExp: "",
  instagram: "",
  email: "",
  phone: "",
};

export function AddEditArtistDialog({
  open,
  onOpenChange,
  artist,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artist: Artist | null;
  onSuccess: (artist: Artist) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (artist) {
        setForm({
          name: artist.name,
          bio: artist.bio ?? "",
          styles: artist.styles ?? [],
          yearsExp:
            artist.years_experience != null
              ? String(artist.years_experience)
              : "",
          instagram: artist.instagram ?? "",
          email: artist.email ?? "",
          phone: artist.phone ?? "",
        });
        setAvatarPreview(artist.avatar_url ?? null);
      } else {
        setForm(EMPTY_FORM);
        setAvatarPreview(null);
      }
      setAvatarFile(null);
      setError(null);
    }
  }, [open, artist]);

  function toggleStyle(style: string) {
    setForm((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  }

  async function uploadAvatar(
    userId: string,
    artistId: number
  ): Promise<string | null> {
    if (!avatarFile) return null;
    const ext = avatarFile.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${artistId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("artist-avatars")
      .upload(path, avatarFile, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage
      .from("artist-avatars")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const userId = await getUserId();
      const payload = {
        name: form.name.trim(),
        bio: form.bio.trim() || null,
        styles: form.styles,
        years_experience: form.yearsExp !== "" ? Number(form.yearsExp) : null,
        instagram: form.instagram.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };

      if (artist) {
        // Edit mode
        let avatar_url = artist.avatar_url;
        if (avatarFile && userId) {
          avatar_url = await uploadAvatar(userId, artist.id);
        }
        const { data: saved, error: updateError } = await supabase
          .from("artists")
          .update({ ...payload, avatar_url })
          .eq("id", artist.id)
          .select("*")
          .single();
        if (updateError) throw new Error(updateError.message);
        onSuccess(saved as Artist);
      } else {
        // Add mode
        const { data: inserted, error: insertError } = await supabase
          .from("artists")
          .insert({ ...payload, user_id: userId })
          .select("*")
          .single();
        if (insertError) throw new Error(insertError.message);
        const newArtist = inserted as Artist;
        let avatar_url = newArtist.avatar_url;
        if (avatarFile && userId) {
          avatar_url = await uploadAvatar(userId, newArtist.id);
          const { data: updated, error: avatarUpdateError } = await supabase
            .from("artists")
            .update({ avatar_url })
            .eq("id", newArtist.id)
            .select("*")
            .single();
          if (avatarUpdateError) throw new Error(avatarUpdateError.message);
          onSuccess(updated as Artist);
        } else {
          onSuccess(newArtist);
        }
      }

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const initial = form.name.trim().charAt(0).toUpperCase() || "A";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--nb-card)] border border-[var(--nb-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--nb-text)]">
            {artist ? "Edit Artist" : "Add Artist"}
          </DialogTitle>
          <DialogDescription className="sr-only">Artist profile details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative size-16 shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="size-16 rounded-full object-cover border border-[var(--nb-border)]"
                />
              ) : (
                <div className="size-16 rounded-full bg-[#7C3AED]/20 border border-[var(--nb-border)] flex items-center justify-center text-xl font-bold text-[#7C3AED]">
                  {initial}
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="avatar-upload"
                className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-1.5 text-xs text-[var(--nb-text-2)] hover:text-[var(--nb-text)] hover:border-[#7C3AED]/40 transition-colors"
              >
                <Upload size={12} />
                Upload photo
              </label>
              <input
                id="avatar-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-xs text-[var(--nb-text-2)] mt-1">
                JPG, PNG, WebP — max 5 MB
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text-2)]">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Artist name"
              className={INPUT_CLASS}
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text-2)]">
              Bio
            </label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Short artist bio…"
              className={INPUT_CLASS + " resize-none"}
            />
          </div>

          {/* Years + Instagram */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text-2)]">
                Years experience
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={form.yearsExp}
                onChange={(e) =>
                  setForm((p) => ({ ...p, yearsExp: e.target.value }))
                }
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text-2)]">
                Instagram
              </label>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) =>
                  setForm((p) => ({ ...p, instagram: e.target.value }))
                }
                placeholder="@handle"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text-2)]">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="artist@email.com"
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text-2)]">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+1 555 000 0000"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Styles */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--nb-text-2)]">
              Styles
            </label>
            <div className="flex flex-wrap gap-2">
              {TATTOO_STYLES.map((style) => {
                const active = form.styles.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                      (active
                        ? "bg-[#7C3AED] text-white"
                        : "bg-[var(--nb-bg)] text-[var(--nb-text-2)] border border-[var(--nb-border)] hover:border-[#7C3AED]/40")
                    }
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="border-[var(--nb-border)] text-[var(--nb-text-2)]"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {artist ? "Save changes" : "Add artist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
