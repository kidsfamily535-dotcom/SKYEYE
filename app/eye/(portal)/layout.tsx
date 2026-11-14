import "../eye.css";
import type { Metadata } from "next";
import { eyeT } from "@/lib/eye/i18n-server";
import { myWorkspaces } from "@/lib/eye/api";
import EyeLang from "@/components/eye/EyeLang";

export async function generateMetadata(): Promise<Metadata> { const { t } = await eyeT(); return { title: t("brand") }; }

export default async function EyeLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = await eyeT();
  const ws = await myWorkspaces();
  const linked = ws.ok && ws.data.length > 0;
  return (
    <div className="eye-shell">
      <header className="eye-top">
        <div className="eye-brand"><strong>{t("brand")}</strong><small className="ltr">{t("brandSub")}</small></div>
        <span className="grow" />
        <EyeLang lang={lang} label={t("lang")} />
        <form action="/auth/signout" method="post"><button className="btn ghost sm">{t("signout")}</button></form>
      </header>
      <main className="eye-main">
        {linked ? children : (
          <section className="card glass eye-empty" role="alert">
            <h1>{t("noAccessTitle")}</h1>
            <p className="muted">{t("noAccessBody")}</p>
          </section>
        )}
      </main>
    </div>
  );
}
