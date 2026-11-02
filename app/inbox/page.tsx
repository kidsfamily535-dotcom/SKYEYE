import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import Hint from "@/components/Hint";
import DraftPanel from "@/components/DraftPanel";
import OpenRequestForm from "@/components/OpenRequestForm";
import CopyButton from "@/components/CopyButton";
import { getFilesForMessage, resolveAirlines } from "@/lib/requests";
import { getCommandData } from "@/lib/data";
import { getInbox, CATEGORY_AR, URGENCY_AR, STATUS_AR, ATT_AR, type InboxItem } from "@/lib/inbox";

const tone = (u: string) => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(5, 10) : "");
const full = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");
const title = (i: InboxItem) => i.message?.subject ?? CATEGORY_AR[i.category] ?? i.category;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ id?: string; q?: string; f?: string }> }) {
  const [d, all, sp] = await Promise.all([getCommandData(), getInbox(), searchParams]);
  const needle = (sp.q ?? "").trim().toLowerCase();
  const items = all.filter((i) => (sp.f !== "new" || i.status === "new") && (!needle || [i.message?.subject, i.summary, i.flightNumber, i.message?.from].some((x) => (x ?? "").toLowerCase().includes(needle))));
  const selId = sp.id ?? (items.find((i) => i.status === "new") ?? items[0])?.id;
  const sel = all.find((i) => i.id === selId) ?? null;
  const idx = sel ? items.findIndex((i) => i.id === sel.id) : -1;
  const q = (id: string) => { const p = new URLSearchParams({ id }); if (needle) p.set("q", sp.q ?? ""); if (sp.f === "new") p.set("f", "new"); return `/inbox?${p}`; };
  const listHref = (f?: string) => { const p = new URLSearchParams(); if (needle) p.set("q", sp.q ?? ""); if (f) p.set("f", f); const s = p.toString(); return `/inbox${s ? `?${s}` : ""}`; };
  const [files, airlines] = sel ? await Promise.all([getFilesForMessage(sel.messageId), resolveAirlines([sel.flightNumber])]) : [{ linked: [], linkable: [] }, new Map()];
  const airline = sel?.flightNumber ? [...airlines.values()][0] ?? null : null;
  const newCount = all.filter((i) => i.status === "new").length;

  // one primary action, taken from what SKYEYE actually prepared; never a recorded time
  const primary = !sel ? null
    : sel.draft?.status === "draft" ? { label: "راجع المسودة", href: "#draft" }
    : sel.flightRotationId && sel.category === "mvt" ? { label: "سجّل الوقت الفعلي في الرحلة", href: `/flights?id=${sel.flightRotationId}&view=timeline` }
    : sel.flightRotationId ? { label: "افتح ملف الرحلة", href: `/flights?id=${sel.flightRotationId}` } : null;

  return (
    <Shell data={d}>
      <main className="page">
        <section className="fhero" aria-label="الوارد والمسودات"><h1>الوارد والمسودات</h1><p>كل الإيميلات المرتبطة برحلاتك في مكان واحد{newCount ? ` · ${newCount} جديد` : ""}.</p></section>
        <div className={`imail ${sp.id ? "reading" : ""}`}>
          <section className="ilist card" aria-label="قائمة الإيميلات">
            <form method="get" action="/inbox" role="search" className="isearch">
              {sp.f === "new" && <input type="hidden" name="f" value="new" />}
              <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="ابحث في الإيميلات أو رقم الرحلة…" aria-label="بحث في الإيميلات" />
            </form>
            <div className="ffilters"><Link className={`chip-link ${sp.f !== "new" ? "on" : ""}`} href={listHref()}>الكل</Link><Link className={`chip-link ${sp.f === "new" ? "on" : ""}`} href={listHref("new")}>جديد</Link></div>
            {items.length === 0 && <p className="muted">{all.length === 0 ? "لا توجد إيميلات بعد. ستظهر هنا فور وصولها وتحليلها." : "لا نتائج مطابقة."}</p>}
            <ul className="mlist">
              {items.map((i) => (
                <li key={i.id} className={`mrow ${i.id === sel?.id ? "cur" : ""}`}>
                  <Link href={q(i.id)} aria-current={i.id === sel?.id ? "true" : undefined}>
                    <span className="mtime ltr"><b>{hm(i.message?.at ?? i.createdAt)}</b><small>{day(i.message?.at ?? i.createdAt)}</small></span>
                    <span className="mbody"><b className="mtitle"><bdi>{title(i)}</bdi></b><small className="muted"><bdi>{i.summary ?? ""}</bdi></small>
                      <small className="muted">{i.flightNumber && <span className="ltr">{i.flightNumber} · </span>}{CATEGORY_AR[i.category] ?? i.category}{i.message?.hasAttachments ? " · 📎" : ""}</small></span>
                    <span className="mflags">{i.status === "new" && <i className={`dot ${tone(i.urgency)}`} aria-label="جديد" />}{i.draft?.status === "draft" && <em className="tag warn">مسودة</em>}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <small className="muted">{items.length} من {all.length} رسالة</small>
          </section>

          <section className="ireader" aria-label="تفاصيل الإيميل">
            {!sel && <div className="card"><p className="muted">اختر إيميلاً لعرضه.</p></div>}
            {sel && <>
              <div className="itool">
                <Link className="back ireturn" href={listHref(sp.f)}>‹ كل الرسائل</Link>
                <span className="grow" />
                {idx > 0 && <Link className="btn ghost sm" href={q(items[idx - 1].id)} aria-label="الإيميل السابق">›</Link>}
                {idx >= 0 && idx < items.length - 1 && <Link className="btn ghost sm" href={q(items[idx + 1].id)} aria-label="الإيميل التالي">‹</Link>}
                <CopyButton text={sel.message?.body ?? ""} label="نسخ النص" />
                {sel.draft && <Link className="btn sm" href="#draft">رد</Link>}
                {sel.flightRotationId ? <Link className="btn gold sm" href={`/flights?id=${sel.flightRotationId}`}>افتح الرحلة</Link> : <span className="tag info">غير مربوطة برحلة</span>}
              </div>

              <div className="card">
                <div className="mhead">
                  {airline && <Logo url={airline.logoUrl} code={airline.code} name={airline.name} size="md" />}
                  <div><h2><bdi>{title(sel)}</bdi></h2>
                    <div className="chips"><span className={`tag ${tone(sel.urgency)}`}>{URGENCY_AR[sel.urgency]}</span><span className="tag info">{CATEGORY_AR[sel.category] ?? sel.category}</span><span className={`tag ${sel.status === "new" ? "warn" : "ok"}`}>{STATUS_AR[sel.status] ?? sel.status}</span></div></div>
                </div>
                <dl className="meta ltr"><div><dt>From</dt><dd>{sel.message?.from}</dd></div><div><dt>To</dt><dd>{sel.message?.to.join(", ")}</dd></div>{sel.message?.cc.length ? <div><dt>Cc</dt><dd>{sel.message.cc.join(", ")}</dd></div> : null}<div><dt>Date</dt><dd>{full(sel.message?.at ?? sel.createdAt)}</dd></div></dl>
                <pre className="ltr orig">{sel.message?.body}</pre>
              </div>

              <div className="card understand">
                <h2>ملخص الوكيل<Hint>ما فهمه SKYEYE من الرسالة. راجعه دائماً قبل الاعتماد عليه.</Hint></h2>
                <p>{sel.summary ?? "لا يوجد ملخص."}</p>
                <dl>
                  <div><dt>ماذا يريد؟</dt><dd>{sel.requestedAction ?? "لا يوجد طلب محدد."}</dd></div>
                  <div><dt>هل نرد؟</dt><dd>{sel.replyKind === "acknowledge" ? "نعم، رد استلام." : "نعم، رد موضوعي."} {sel.replyReason}</dd></div>
                  <div><dt>الرحلة</dt><dd className="ltr">{sel.flightLabel ?? "غير مربوطة بعد"}</dd></div>
                  <div><dt>المرفقات</dt><dd>{sel.attachments.length === 0 ? (sel.message?.hasAttachments ? "فيه مرفقات لم تُسجَّل بعد." : "لا يوجد.") : sel.attachments.map((a) => <div key={a.name}><bdi className="ltr">{a.name}</bdi> — {ATT_AR[a.state] ?? a.state}</div>)}</dd></div>
                </dl>
              </div>

              <div className="card actions-card">
                <h2>الإجراءات المقترحة</h2>
                <div className="row">
                  {primary ? <Link className="btn gold" href={primary.href}>{primary.label}</Link> : <p className="muted">لا إجراء مقترح الآن.</p>}
                  {sel.flightRotationId && primary?.href !== `/flights?id=${sel.flightRotationId}` && <Link className="btn" href={`/flights?id=${sel.flightRotationId}`}>متابعة الخط الزمني</Link>}
                </div>
                <details><summary>ملفات الطلبات</summary><OpenRequestForm key={sel.id} companyId={d.company.id} triageId={sel.id} messageId={sel.messageId} linked={files.linked} linkable={files.linkable} /></details>
              </div>

              <div className="card" id="draft"><h2>المسودة (بالإنجليزية)</h2>
                {sel.draft ? <DraftPanel key={sel.draft.id} draft={sel.draft} /> : <p className="muted">لم يجهّز الوكيل مسودة لهذا الإيميل بعد.</p>}
              </div>
            </>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
