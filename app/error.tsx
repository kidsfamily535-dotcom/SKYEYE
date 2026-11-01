"use client";

/** Shown when a page fails to load. The employee can retry; nothing is lost. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="state-screen" role="alert">
      <div className="card stack">
        <h1>تعذّر تحميل الصفحة</h1>
        <p className="muted">حدث خطأ أثناء جلب البيانات. جرّب مرة أخرى، وإن تكرر أبلغ المسؤول.</p>
        <button type="button" className="btn gold" onClick={reset}>إعادة المحاولة</button>
      </div>
    </div>
  );
}
