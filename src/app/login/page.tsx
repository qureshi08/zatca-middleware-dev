"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { authInput, authLabel, authBtn, authGhostBtn } from "@/components/AuthShell";
import GoogleIcon from "@/components/GoogleIcon";

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
