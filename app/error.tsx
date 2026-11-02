"use client";
import { useT } from "@/components/I18n";

/** Shows a readable message (instead of a blank screen) if a screen crashes. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  return (
    <div className="login">
      <div className="card" style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2>{t("err.title")}</h2>
        <p className="muted">{t("err.body")} <bdi className="ltr">{error.digest ?? error.message}</bdi></p>
        <div className="row"><button type="button" className="btn gold" onClick={reset}>{t("err.retry")}</button><a className="btn" href="/">{t("err.home")}</a></div>
      </div>
    </div>
  );
}
