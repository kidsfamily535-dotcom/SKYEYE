import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state-screen">
      <div className="card stack">
        <h1>الصفحة غير موجودة</h1>
        <p className="muted">الرابط غير صحيح أو انتقلت الصفحة.</p>
        <Link className="btn gold" href="/">العودة إلى قيادتي</Link>
      </div>
    </div>
  );
}
