"use client";
import "../eye.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18n";
import { eyeText } from "@/lib/eye/i18n";
import EyeLang from "@/components/eye/EyeLang";

// Sign-in for airline users. It only signs in and accepts a pending airline invitation; the middleware decides where the person lands.
export default function EyeLoginPage() {
  const router = useRouter();
  const { lang } = useT();
  const t = eyeText(lang);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
    if (error) { setError(t("loginErr")); setBusy(false); return; }
    await sb.rpc("eye_accept_invites"); // harmless when there is nothing to accept
    router.replace("/eye"); router.refresh();
  }

  return (
    <main className="eye-login">
      <form className="card glass" onSubmit={submit}>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
          <div className="eye-brand"><strong>{t("brand")}</strong><small className="ltr">{t("brandSub")}</small></div>
          <EyeLang lang={lang} label={t("lang")} />
        </div>
        <p className="muted">{t("loginIntro")}</p>
        <label>{t("email")}<input name="email" type="email" required autoComplete="username" className="ltr" /></label>
        <label>{t("password")}<input name="password" type="password" required autoComplete="current-password" className="ltr" /></label>
        {error && <p role="alert" className="err">{error}</p>}
        <button className="btn gold" disabled={busy}>{busy ? t("loginBusy") : t("loginBtn")}</button>
      </form>
    </main>
  );
}
