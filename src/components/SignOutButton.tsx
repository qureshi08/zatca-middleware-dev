"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };
  const style: React.CSSProperties = dark
    ? { width: "100%", padding: "9px 14px", borderRadius: 7, border: "1px solid #2c4a63", background: "#16293b", color: "#cdd8e3", cursor: "pointer", fontSize: 13, fontWeight: 500 }
    : { padding: "7px 14px", borderRadius: 7, border: "1px solid #cfd8e3", background: "#fff", cursor: "pointer", fontSize: 13 };
  return (
    <button onClick={signOut} style={style}>
      Sign out
    </button>
  );
}
