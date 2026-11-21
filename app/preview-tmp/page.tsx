import "../flights/flights.css"; import "../flights/radar.css";
export default function P() {
  return <div className="app" style={{ display: "block", padding: 20 }}><div className="detail ws">
    <header className="fx-head card"><div className="fx-head-top">
      <b className="logo">RJ</b>
      <div className="fx-head-id"><b className="ltr fx-fn">RJ503 / RJ504</b><small>Royal Jordanian · JY-TDA</small></div>
      <p className="fx-head-route ltr">AMM › <b>CAI</b> › AMM</p><span className="grow" />
      <div className="fx-head-times"><span className="fx-seq"><span className="fx-t"><small>وصلت</small><b className="ltr">10:02</b><em>15 Nov</em></span><i>←</i><span className="fx-t"><small>تغادر</small><b className="ltr">11:25</b><em>15 Nov</em></span></span><small className="muted">ساعة و15 دقيقة على الأرض</small></div>
      <a className="btn sm ghost">اسأل الوكيل</a></div>
      <div className="fx-agent t-late"><i /><p><span>على الأرض · تجاوزت موعد الإقلاع بـ 6 أيام و9 ساعات</span></p></div></header>
    <div className="fx-grid"><div className="fx-main"><section className="card"><h2>المطلوب الآن</h2><p>مستحقة الآن ED — افتح الرسالة</p></section><section className="card"><h2>الوقفة</h2><p className="muted">لوحة OTP</p></section><details className="card fold fx-otpmore"><summary>تفاصيل الوقفة وتسجيل التأخير</summary>x</details></div>
    <aside className="fx-side"><div className="card"><h2>القصة</h2><p className="muted">الخط الزمني</p></div><div className="fx-more"><details className="card fold"><summary>المناولة</summary>x</details><details className="card fold"><summary>المراسلات (2)</summary>x</details><a className="card fold fold-link">حركة الطائرة ›</a></div></aside></div>
  </div></div>;
}
