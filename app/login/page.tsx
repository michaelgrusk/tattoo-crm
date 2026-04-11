"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Loader2, Eye, EyeOff, Mail } from "lucide-react";

type Mode = "signin" | "signup" | "verify" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studioName, setStudioName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/board");
      router.refresh();
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { studio_name: studioName },
        },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setVerifyEmail(email);
      setMode("verify");
    }
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    await supabase.auth.resend({ type: "signup", email: verifyEmail });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const origin = window.location.origin;
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${origin}/auth/confirm`,
    });
    setLoading(false);
    setForgotSent(true);
  }

  const inputCls =
    "w-full h-10 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

  // ── Verify screen ──────────────────────────────────────────────────────────
  if (mode === "verify") {
    return (
      <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-8 text-center">
          <div className="size-12 rounded-full bg-[#7C3AED]/10 flex items-center justify-center mx-auto mb-5">
            <Mail size={22} className="text-[#7C3AED]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--nb-text)] mb-2">Check your email</h2>
          <p className="text-sm text-[var(--nb-text-2)] leading-relaxed mb-6">
            We sent a verification link to{" "}
            <span className="font-medium text-[var(--nb-text)]">{verifyEmail}</span>.
            Once verified, your application will be reviewed — usually within 24 hours.
          </p>

          {resent && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
              Verification email resent!
            </p>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full h-10 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] text-sm font-medium text-[var(--nb-text)] hover:bg-[var(--nb-card)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-3"
          >
            {resending && <Loader2 size={14} className="animate-spin" />}
            {resending ? "Resending…" : "Resend email"}
          </button>

          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className="text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
        <p className="mt-6 text-xs text-[var(--nb-text-2)]">© {new Date().getFullYear()} Tatflow</p>
      </div>
    );
  }

  // ── Forgot password screen ─────────────────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-8">
          <div className="flex flex-col items-center mb-6">
            <Image src="/logo.png" alt="Tatflow" width={200} height={200} style={{ height: "80px", width: "auto" }} className="mb-3" priority />
            <h2 className="text-lg font-semibold text-[var(--nb-text)]">Reset password</h2>
            <p className="text-xs text-[var(--nb-text-2)] mt-1 text-center">
              Enter your email and we&apos;ll send a reset link
            </p>
          </div>

          {forgotSent ? (
            <div className="text-center space-y-4">
              <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Mail size={22} className="text-emerald-600" />
              </div>
              <p className="text-sm text-[var(--nb-text-2)] leading-relaxed">
                Check your email for a password reset link.
              </p>
              <button
                type="button"
                onClick={() => { setMode("signin"); setForgotSent(false); setForgotEmail(""); }}
                className="text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--nb-text)]">Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className={inputCls}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(null); }}
                  className="text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors"
                >
                  ← Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
        <p className="mt-6 text-xs text-[var(--nb-text-2)]">© {new Date().getFullYear()} Tatflow</p>
      </div>
    );
  }

  // ── Sign in / Sign up ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-8">
        {/* Branding */}
        <div className="flex flex-col items-center mb-7">
          <Image src="/logo.png" alt="Tatflow" width={200} height={200} style={{ height: "110px", width: "auto" }} className="mb-3" priority loading="eager" />
          <h1 className="text-xl font-semibold text-[var(--nb-text)]">Tatflow</h1>
          <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Tattoo studio management</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-1 mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === m
                  ? "bg-[var(--nb-card)] text-[var(--nb-text)] shadow-sm"
                  : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              }`}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Studio name — sign up only */}
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Studio name</label>
              <input
                type="text"
                placeholder="e.g. Ink & Co."
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                className={inputCls}
                autoComplete="organization"
              />
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputCls}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--nb-text)]">Password</label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setForgotEmail(email); setError(null); }}
                  className="text-xs text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${inputCls} pr-10`}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] hover:text-[var(--nb-text-2)] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm password — sign up only */}
          {mode === "signup" && (
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
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading
              ? mode === "signin" ? "Signing in…" : "Creating account…"
              : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-[var(--nb-text-2)]">
        © {new Date().getFullYear()} Tatflow
      </p>
    </div>
  );
}
