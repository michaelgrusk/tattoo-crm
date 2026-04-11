"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const inputCls =
  "w-full h-10 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[reset-password] auth state change:", event, "session:", session?.user?.email ?? null);
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[reset-password] getSession:", session?.user?.email ?? null);
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/board"), 2000);
  }

  return (
    <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-8">
        {/* Branding */}
        <div className="flex flex-col items-center mb-7">
          <Image
            src="/logo.png"
            alt="Tatflow"
            width={200}
            height={200}
            style={{ height: "80px", width: "auto" }}
            className="mb-3"
            priority
          />
          <h1 className="text-lg font-semibold text-[var(--nb-text)]">Set new password</h1>
          <p className="text-xs text-[var(--nb-text-2)] mt-1">Choose a new password for your account</p>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-[var(--nb-text)]">Password updated!</p>
            <p className="text-xs text-[var(--nb-text-2)]">Redirecting you to your board…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${inputCls} pr-10`}
                  autoComplete="new-password"
                  autoFocus
                  disabled={!sessionReady}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Confirm password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputCls}
                autoComplete="new-password"
                disabled={!sessionReady}
              />
            </div>

            {!sessionReady && (
              <p className="text-xs text-[var(--nb-text-2)] flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin shrink-0" />
                Verifying reset link…
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !sessionReady}
              className="w-full h-10 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--nb-text-2)]">
        © {new Date().getFullYear()} Tatflow
      </p>
    </div>
  );
}
