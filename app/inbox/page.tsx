import Link from "next/link";
import Shell from "@/components/Shell";
import DraftPanel from "@/components/DraftPanel";
import OpenRequestForm from "@/components/OpenRequestForm";
import { getFilesForMessage } from "@/lib/requests";
import { getCommandData } from "@/lib/data";
import { getInbox } from "@/lib/inbox";
import { fmtShort } from "@/lib/format";
import { CATEGORY_AR, URGENCY_AR, INBOX_STATUS_AR, urgencyTone } from "@/lib/labels";
import { PageHeader, Split, Tag, Empty } from "@/components/ui";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const [d, items, sp] = await Promise.all([getCommandData(), getInbox(), searchParams]);
  const sel = items.find((i) => i.id === sp.id) ?? items.find((i) => i.status === "new") ?? items[0];
  const files = sel ? await getFilesForMessage(sel.messageId) : { linked: [], linkable: [] };

  return (
    <Shell data={d}>
      <main className="page">
        <PageHeader title="الوارد والمسودات" subtitle="كل إيميل جديد: ما هو، ماذا يريد، هل نرد، ثم المسودة جاهزة للمراجعة." />
        <Split>
        <section className="card" aria-label="قائمة الإيميلات">
          <h2>الوارد</h2>
          {items.length === 0 && <Empty>لا توجد إيميلات بعد. ستظهر هنا فور وصولها وتحليلها.</Empty>}
          <ul className="list">
            {items.map((i) => (
              <li key={i.id} className={i.id === sel?.id ? "cur" : ""}>
                <i className={`dot ${urgencyTone(i.urgency)}`} />
                <Link href={`/inbox?id=${i.id}`} className="item" aria-current={i.id === sel?.id ? "true" : undefined}>
                  <b>{CATEGORY_AR[i.category] ?? i.category}</b>
                  <span>{i.summary}</span>
                  <small className="muted">{i.message?.from ?? ""} · {fmtShort(i.message?.at ?? i.createdAt)}</small>
                </Link>
                <Tag tone={i.status === "new" ? "warn" : "ok"}>{INBOX_STATUS_AR[i.status] ?? i.status}</Tag>
              </li>
            ))}
          </ul>
        </section>

        {sel && (
          <section className="detail" aria-label="تفاصيل الإيميل">
            <div className="card">
              <div className="chips"><Tag tone={urgencyTone(sel.urgency)}>{URGENCY_AR[sel.urgency]}</Tag><Tag>{CATEGORY_AR[sel.category] ?? sel.category}</Tag></div>
              <h3>ما هو؟</h3><p>{sel.summary}</p>
              <h3>ماذا يريد؟</h3><p>{sel.requestedAction ?? "لا يوجد طلب محدد."}</p>
              <h3>هل نرد؟</h3><p>{sel.replyKind === "acknowledge" ? "نعم، رد استلام." : "نعم، رد موضوعي."} {sel.replyReason}</p>
              <details><summary>الإيميل الأصلي</summary>
                <dl className="meta ltr"><div><dt>From</dt><dd>{sel.message?.from}</dd></div><div><dt>To</dt><dd>{sel.message?.to.join(", ")}</dd></div>{sel.message?.cc.length ? <div><dt>Cc</dt><dd>{sel.message.cc.join(", ")}</dd></div> : null}<div><dt>Subject</dt><dd>{sel.message?.subject}</dd></div></dl>
                <pre className="ltr orig">{sel.message?.body}</pre>
                {sel.message?.hasAttachments && <p className="muted">فيه مرفقات تُقرأ في جلسة لاحقة.</p>}
              </details>
            </div>
            <div className="card"><h3>ملفات الطلبات</h3><OpenRequestForm key={sel.id} companyId={d.company.id} triageId={sel.id} messageId={sel.messageId} linked={files.linked} linkable={files.linkable} /></div>
            <div className="card"><h3>المسودة (بالإنجليزية)</h3>
              {sel.draft ? <DraftPanel key={sel.draft.id} draft={sel.draft} /> : <Empty>لم يجهّز الوكيل مسودة لهذا الإيميل بعد.</Empty>}
            </div>
          </section>
        )}
        </Split>
      </main>
    </Shell>
  );
}
