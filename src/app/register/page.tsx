"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { authInput, authLabel, authBtn, authGhostBtn } from "@/components/AuthShell";

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.6 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function RegisterInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/onboarding";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const emailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don’t match."); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    // If email confirmation is OFF, a session is returned → go straight in.
    if (data.session) { router.push(next); router.refresh(); return; }
    // Otherwise prompt to confirm via email.
    setSent(email.trim());
    setLoading(false);
  };

  const googleSignUp = async () => {
    setGLoading(true); setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setGLoading(false); }
  };

  if (sent) {
    return (
      <AuthShell title="Confirm your email" subtitle={`We sent a confirmation link to ${sent}.`}>
        <div style={{ background: "#eef5fc", border: "1px solid #bcd9f2", color: "#155a93", fontSize: 13, padding: "12px 14px", borderRadius: 9 }}>
          Click the link in that email to activate your account, then sign in. Didn&apos;t get it? Check spam, or <Link href="/register" style={{ color: "#1F6FB2", fontWeight: 600 }}>try again</Link>.
        </div>
        <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}><Link href="/login" style={{ color: "#1F6FB2", fontWeight: 600, fontSize: 13 }}>← Back to sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Get ZATCA-compliant without leaving the software you already use.">
      {error && <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", fontSize: 12.5, padding: "9px 11px", borderRadius: 8, marginBottom: 14 }}>{error}</div>}

      <form onSubmit={emailSignUp}>
        <label style={authLabel}>Work email</label>
        <input style={authInput} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <label style={{ ...authLabel, marginTop: 14 }}>Password</label>
        <input style={authInput} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <label style={{ ...authLabel, marginTop: 14 }}>Confirm password</label>
        <input style={authInput} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
        <button type="submit" disabled={loading} style={{ ...authBtn, marginTop: 18, opacity: loading ? 0.6 : 1 }}>{loading ? "Creating account…" : "Create account"}</button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#e3e8ef" }} />
        <span style={{ color: "#8a97a6", fontSize: 12 }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#e3e8ef" }} />
      </div>

      <button type="button" onClick={googleSignUp} disabled={gLoading} style={{ ...authGhostBtn, opacity: gLoading ? 0.6 : 1 }}>
        <GoogleIcon /> {gLoading ? "Redirecting…" : "Sign up with Google"}
      </button>

      <p style={{ textAlign: "center", color: "#6b7785", fontSize: 13, marginTop: 18, marginBottom: 0 }}>
        Already have an account? <Link href="/login" style={{ color: "#1F6FB2", fontWeight: 600 }}>Sign in</Link>
      </p>
      <p style={{ textAlign: "center", color: "#9aa6b2", fontSize: 11, marginTop: 10, marginBottom: 0 }}>
        You&apos;ll add your business details (VAT, CR) during onboarding.
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthShell title="Create your account"><div style={{ color: "#8a97a6", fontSize: 13 }}>Loading…</div></AuthShell>}>
      <RegisterInner />
    </Suspense>
  );
}
