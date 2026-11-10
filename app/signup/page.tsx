"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18n";
import LangSwitch from "@/components/LangSwitch";

/** Self sign-up. Nothing is granted here: the person joins a company only if an admin already invited this exact, confirmed email. */
export default function SignupPage() {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password")); 
    if (password !== String(f.get("confirm"))) { setError(t("signup.mismatch")); return; }
    setBusy(true);
    const { error } = await createClient().auth.signUp({ email: String(f.get("email")).trim(), password, options: { emailRedirectTo: `${window.location.origin}/login` } });
    setBusy(false);
    if (error) { setError(t("signup.error")); return; }
    setSent(true);
  }

  return (
    <main className="login">
      <form className="card glass" onSubmit={submit}>
        <div className="row" style={{ justifyContent: "space-between" }}><strong className="wordmark">SKYEYE</strong><LangSwitch /></div>
        <p className="muted">{t("signup.intro")}</p>
        {sent ? <p role="status">{t("signup.sent")}</p> : (
          <>
            <label>{t("login.email")}<input name="email" type="email" required autoComplete="username" className="ltr" /></label>
            <label>{t("login.password")}<input name="password" type="password" required minLength={8} autoComplete="new-password" className="ltr" /></label>
            <label>{t("signup.confirm")}<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="ltr" /></label>
            {error && <p role="alert" className="err">{error}</p>}
            <button className="btn gold" disabled={busy}>{busy ? t("signup.busy") : t("signup.submit")}</button>
          </>
        )}
        <p className="muted"><Link href="/login">{t("signup.back")}</Link></p>
      </form>
    </main>
  );
}
