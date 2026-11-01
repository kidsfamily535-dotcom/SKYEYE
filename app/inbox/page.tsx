import Link from "next/link";
import Shell from "@/components/Shell";
import DraftPanel from "@/components/DraftPanel";
import OpenRequestForm from "@/components/OpenRequestForm";
import { getFilesForMessage } from "@/lib/requests";
import { getCommandData } from "@/lib/data";
import { getInbox, stateLabel, stateOf, stateTone, CATEGORY_AR, URGENCY_AR } from "@/lib/inbox";

const tone = (u: string) => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");
const FILTERS = [{ key: "all", label: "الكل" }, { key: "new", label: "جديد" }, { key: "drafted", label: "عليه مسودة" }, { key: "replied", label: "تم الرد" }] as const;
const when = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(5, 16).replace("T", " ") + " UTC" : "");

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ id?: string; f?: string }> }) {
  const [d, items, sp] = await Promise.all([getCommandData(), getInbox(), searchParams]);
  const f = FILTERS.some((x) => x.key === sp.f) ? sp.f! : "all";
  // Already ordered: new first, then by urgency (urgent, important, normal), then newest.
  const shown = f === "all" ? items : items.filter((i) => stateOf(i) === f);
  const count = (k: string) => (k === "all" ? items.length : items.filter((i) => stateOf(i) === k).length);
  const sel = items.find((i) => i.id === sp.id) ?? shown.find((i) => i.status === "new") ?? shown[0];
  const files = sel ? await getFilesForMessage(sel.messageId) : { linked: [], linkable: [] };

  return (
    <Shell data={d} scope="inbox" agent={sel ? { targetType: "email_message", targetId: sel.messageId, label: sel.message?.subject ?? sel.summary ?? "إيميل" } : null}>
      <main className="inbox">
        <section className="card" aria-label="قائمة الإيميلات">
          <h2>الوارد</h2>
          <div className="tabs wrap" role="tablist" aria-label="تصفية الإيميلات">
            {FILTERS.map((x) => <Link key={x.key} role="tab" aria-selected={f === x.key} className={f === x.key ? "on" : ""} href={x.key === "all" ? "/inbox" : `/inbox?f=${x.key}`}>{x.label} <span className="ltr">{count(x.key)}</span></Link>)}
          </div>
          {items.length === 0 && <p className="muted">لا توجد إيميلات بعد. ستظهر هنا فور وصولها وتحليلها.</p>}
          {items.length > 0 && shown.length === 0 && <p className="muted">لا إيميلات في هذه التصفية.</p>}
          <ul className="list">
            {shown.map((i) => (
              <li key={i.id} className={i.id === sel?.id ? "cur" : ""}>
                <i className={`dot ${tone(i.urgency)}`} />
                <Link href={`/inbox?id=${i.id}${f === "all" ? "" : `&f=${f}`}`} className="item" aria-current={i.id === sel?.id ? "true" : undefined}>
                  <b>{CATEGORY_AR[i.category] ?? i.category}</b>
                  <span>{i.summary}</span>
                  <small className="muted">{i.message?.from ?? ""} · {when(i.message?.at ?? i.createdAt)}</small>
                </Link>
                <em className={`tag ${stateTone(i)}`}>{stateLabel(i)}</em>
              </li>
            ))}
          </ul>
        </section>

        {sel && (
          <section className="detail" aria-label="تفاصيل الإيميل">
            <div className="card">
              <div className="chips"><span className={`tag ${tone(sel.urgency)}`}>{URGENCY_AR[sel.urgency]}</span><span className="tag info">{CATEGORY_AR[sel.category] ?? sel.category}</span></div>
              <h3>ما هو؟</h3><p>{sel.summary}</p>
              <h3>ماذا يريد؟</h3><p>{sel.requestedAction ?? "لا يوجد طلب محدد."}</p>
              <h3>هل نرد؟</h3><p>{sel.replyKind === "acknowledge" ? "نعم، رد استلام." : "نعم، رد موضوعي."} {sel.replyReason}</p>
              <details><summary>الإيميل الأصلي</summary>
                <dl className="meta ltr"><div><dt>From</dt><dd>{sel.message?.from}</dd></div><div><dt>To</dt><dd>{sel.message?.to.join(", ")}</dd></div>{sel.message?.cc.length ? <div><dt>Cc</dt><dd>{sel.message.cc.join(", ")}</dd></div> : null}<div><dt>Subject</dt><dd>{sel.message?.subject}</dd></div></dl>
                <pre className="ltr orig">{sel.message?.body}</pre>
                {sel.message?.hasAttachments && <p className="muted">فيه مرفقات تُقرأ في جلسة لاحقة.</p>}
              </details>
            </div>
            {sel && <div className="card"><h3>ملفات الطلبات</h3><OpenRequestForm key={sel.id} companyId={d.company.id} triageId={sel.id} messageId={sel.messageId} linked={files.linked} linkable={files.linkable} /></div>}
            <div className="card"><h3>المسودة (بالإنجليزية)</h3>
              {sel.draft ? <DraftPanel key={sel.draft.id} draft={sel.draft} /> : <p className="muted">لم يجهّز الوكيل مسودة لهذا الإيميل بعد.</p>}
            </div>
          </section>
        )}
      </main>
    </Shell>
  );
}
