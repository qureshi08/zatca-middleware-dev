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

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(sp.get("registered") ? "Account created — sign in to continue." : sp.get("reset") ? "Password updated — sign in with your new password." : null);

  const emailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(next); router.refresh();
  };

  const googleSignIn = async () => {
    setGLoading(true); setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setGLoading(false); }
  };

  const forgotPassword = async () => {
    if (!email.trim()) { setError("Enter your email above first, then click “Forgot password?”."); return; }
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password` });
    if (error) setError(error.message);
    else setNotice(`Password reset link sent to ${email.trim()}. Check your inbox.`);
  };

  return (
    <AuthShell title="Sign in" subtitle="Welcome back — access your ZATCA compliance dashboard.">
      {notice && <div style={{ background: "#e9f8ef", border: "1px solid #b6e4c6", color: "#1f7a45", fontSize: 12.5, padding: "9px 11px", borderRadius: 8, marginBottom: 14 }}>{notice}</div>}
      {error && <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", fontSize: 12.5, padding: "9px 11px", borderRadius: 8, marginBottom: 14 }}>{error}</div>}

      <form onSubmit={emailSignIn}>
        <label style={authLabel}>Email</label>
        <input style={authInput} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 5px" }}>
          <label style={{ ...authLabel, margin: 0 }}>Password</label>
          <button type="button" onClick={forgotPassword} style={{ background: "none", border: "none", color: "#00994D", fontSize: 12, cursor: "pointer", padding: 0 }}>Forgot password?</button>
        </div>
        <input style={authInput} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <button type="submit" disabled={loading} style={{ ...authBtn, marginTop: 18, opacity: loading ? 0.6 : 1 }}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#e3e8ef" }} />
        <span style={{ color: "#8a97a6", fontSize: 12 }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#e3e8ef" }} />
      </div>

      <button type="button" onClick={googleSignIn} disabled={gLoading} style={{ ...authGhostBtn, opacity: gLoading ? 0.6 : 1 }}>
        <GoogleIcon /> {gLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <p style={{ textAlign: "center", color: "#6b7785", fontSize: 13, marginTop: 18, marginBottom: 0 }}>
        Don&apos;t have an account? <Link href="/register" style={{ color: "#00994D", fontWeight: 600 }}>Sign up</Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Sign in"><div style={{ color: "#8a97a6", fontSize: 13 }}>Loading…</div></AuthShell>}>
      <LoginInner />
    </Suspense>
  );
}
