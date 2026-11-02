"use client";

/** Shows a readable message (instead of a blank screen) if a screen crashes. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="login">
      <div className="card" style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2>حصلت مشكلة في الشاشة دي</h2>
        <p className="muted">جرّب مرة تانية. ولو اتكررت ابعت لي الكود ده: <bdi className="ltr">{error.digest ?? error.message}</bdi></p>
        <div className="row"><button type="button" className="btn gold" onClick={reset}>جرّب تاني</button><a className="btn" href="/">الرئيسية</a></div>
      </div>
    </div>
  );
}
