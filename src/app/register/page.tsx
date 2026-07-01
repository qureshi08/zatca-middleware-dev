"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { authInput, authLabel, authBtn, authGhostBtn } from "@/components/AuthShell";
import GoogleIcon from "@/components/GoogleIcon";

function RegisterInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
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
        <div style={{ background: "#E6F5ED", border: "1px solid #b7e0c8", color: "#007A3D", fontSize: 13, padding: "12px 14px", borderRadius: 9 }}>
          Click the link in that email to activate your account, then sign in. Didn&apos;t get it? Check spam, or <Link href="/register" style={{ color: "#00994D", fontWeight: 600 }}>try again</Link>.
        </div>
        <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}><Link href="/login" style={{ color: "#00994D", fontWeight: 600, fontSize: 13 }}>← Back to sign in</Link></p>
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
        Already have an account? <Link href="/login" style={{ color: "#00994D", fontWeight: 600 }}>Sign in</Link>
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
