import Link from "next/link";
import Shell from "@/components/Shell";
import DraftPanel from "@/components/DraftPanel";
import { getCommandData } from "@/lib/data";
import { getInbox, CATEGORY_AR, URGENCY_AR, STATUS_AR } from "@/lib/inbox";

const tone = (u: string) => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");
const when = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(5, 16).replace("T", " ") + " UTC" : "");

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const [d, items, sp] = await Promise.all([getCommandData(), getInbox(), searchParams]);
  const sel = items.find((i) => i.id === sp.id) ?? items.find((i) => i.status === "new") ?? items[0];

  return (
    <Shell data={d}>
      <main className="inbox">
        <section className="card" aria-label="قائمة الإيميلات">
          <h2>الوارد</h2>
          {items.length === 0 && <p className="muted">لا توجد إيميلات بعد. ستظهر هنا فور وصولها وتحليلها.</p>}
          <ul className="list">
            {items.map((i) => (
              <li key={i.id} className={i.id === sel?.id ? "cur" : ""}>
                <i className={`dot ${tone(i.urgency)}`} />
                <Link href={`/inbox?id=${i.id}`} className="item" aria-current={i.id === sel?.id ? "true" : undefined}>
                  <b>{CATEGORY_AR[i.category] ?? i.category}</b>
                  <span>{i.summary}</span>
                  <small className="muted">{i.message?.from ?? ""} · {when(i.message?.at ?? i.createdAt)}</small>
                </Link>
                <em className={`tag ${i.status === "new" ? "warn" : "ok"}`}>{STATUS_AR[i.status] ?? i.status}</em>
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
            <div className="card"><h3>المسودة (بالإنجليزية)</h3>
              {sel.draft ? <DraftPanel key={sel.draft.id} draft={sel.draft} /> : <p className="muted">لم يجهّز الوكيل مسودة لهذا الإيميل بعد.</p>}
            </div>
          </section>
        )}
      </main>
    </Shell>
  );
}
