"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18n";
import LangSwitch from "@/components/LangSwitch";
import { syncLanguageAfterLogin } from "@/app/lang-actions";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    if (error) { setError(t("login.error")); setBusy(false); return; }
    // Links this person to their company when an admin invited this confirmed email. Harmless if there is no invitation.
    await createClient().rpc("claim_my_invite");
    await syncLanguageAfterLogin().catch(() => {});
    router.replace("/"); router.refresh();
  }

  return (
    <main className="login">
      <form className="card glass" onSubmit={submit}>
        <div className="row" style={{ justifyContent: "space-between" }}><strong className="wordmark">SKYEYE</strong><LangSwitch /></div>
        <p className="muted">{t("login.intro")}</p>
        <label>{t("login.email")}<input name="email" type="email" required autoComplete="username" className="ltr" /></label>
        <label>{t("login.password")}<input name="password" type="password" required autoComplete="current-password" className="ltr" /></label>
        {error && <p role="alert" className="err">{error}</p>}
        <button className="btn gold" disabled={busy}>{busy ? t("login.busy") : t("login.submit")}</button>
        <p className="muted"><Link href="/signup">{t("login.noAccount")}</Link></p>
      </form>
    </main>
  );
}
