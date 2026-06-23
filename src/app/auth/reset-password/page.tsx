"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { authInput, authLabel, authBtn } from "@/components/AuthShell";

/**
 * Lands here from the password-reset email (via /auth/callback, which exchanges
 * the recovery code into a session). The user is authenticated for this one
 * action: set a new password, then sign out and return to login.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don’t match."); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    await supabase.auth.signOut();
    router.push("/login?reset=1");
    router.refresh();
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your account.">
      {error && <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", fontSize: 12.5, padding: "9px 11px", borderRadius: 8, marginBottom: 14 }}>{error}</div>}
      <form onSubmit={submit}>
        <label style={authLabel}>New password</label>
        <input style={authInput} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <label style={{ ...authLabel, marginTop: 14 }}>Confirm new password</label>
        <input style={authInput} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
        <button type="submit" disabled={loading} style={{ ...authBtn, marginTop: 18, opacity: loading ? 0.6 : 1 }}>{loading ? "Updating…" : "Update password"}</button>
      </form>
    </AuthShell>
  );
}
