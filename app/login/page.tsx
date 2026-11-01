"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    if (error) { setError("البريد أو كلمة المرور غير صحيحين."); setBusy(false); return; }
    router.replace("/"); router.refresh();
  }

  return (
    <main className="login">
      <form className="card glass" onSubmit={submit}>
        <strong className="wordmark">SKYEYE</strong>
        <p className="muted">سجّل دخولك بحسابك الخاص. كل حساب تابع لشركة واحدة.</p>
        <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="username" className="ltr" /></label>
        <label>كلمة المرور<input name="password" type="password" required autoComplete="current-password" className="ltr" /></label>
        {error && <p role="alert" className="err">{error}</p>}
        <button className="btn gold" disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول"}</button>
      </form>
    </main>
  );
}
