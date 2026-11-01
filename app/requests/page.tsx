import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import RequestActions from "@/components/RequestActions";
import AlertActions from "@/components/AlertActions";
import { getCommandData } from "@/lib/data";
import { fmtUtc, hoursPhrase } from "@/lib/format";
import { getAlerts, getPolicies, getRequest, getRequestList, getStages, ACTOR_AR, TYPE_AR, WAITING_AR, type RequestRow, type Stage } from "@/lib/requests";

const POLICY_AR: Record<string, string> = { warn_before_hours: "تنبيه قبل موعد الطلب", urgent_hours: "ما يُعدّ عاجلاً قبل الرحلة", lead_time_hours: "المهلة الطبيعية قبل الرحلة", stall_after_hours: "الطلب الراكد بعد" };
const KIND_AR = { overdue: "متأخر", due: "اقترب موعده", stalled: "راكد" } as const;

function Progress({ stages, current, status }: { stages: Stage[]; current: string; status: string }) {
  const line = stages.filter((s) => s.code !== "cancelled");
  const idx = Math.max(0, line.findIndex((s) => s.code === current));
  const pct = status === "cancelled" ? 0 : Math.round(((idx + (status === "closed" ? 1 : 0)) / (line.length - 1)) * 100);
  return <div className={`bar ${status === "cancelled" ? "off" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم الطلب"><i style={{ width: `${pct}%` }} /></div>;
}

function Airline({ r }: { r: RequestRow }) {
  return r.airline ? <span className="airline"><Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} />{r.airline.name && <small>{r.airline.name}</small>}</span> : null;
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "open";
  const [d, list, alerts, policies, { stages, transitions }] = await Promise.all([getCommandData(), getRequestList(tab), getAlerts(), getPolicies(), getStages()]);
  const sel = sp.id ? await getRequest(sp.id) : list[0] ? await getRequest(list[0].id) : null;
  const typeStages = (t: string) => stages.filter((s) => s.type === t);
  const moves = sel ? transitions.filter((t) => t.type === sel.row.type && t.from === sel.row.stage).map((t) => ({ to: t.to, label: stages.find((s) => s.type === t.type && s.code === t.to)?.labelAr ?? t.to })) : [];

  return (
    <Shell data={d}>
      <main className="page">
        {alerts.length > 0 && (
          <section className="card" aria-label="التنبيهات">
            <h2>تنبيهات الطلبات</h2>
            <ul className="list">
              {alerts.map((a) => (
                <li key={a.id} className="alert-row">
                  <i className={`dot ${a.severity === "high" ? "late" : "warn"}`} />
                  <span>
                    <em className={`tag ${a.severity === "high" ? "late" : "warn"}`}>{KIND_AR[a.kind]}</em>{" "}
                    {a.file ? <Link href={`/requests?id=${a.file.id}`}><bdi>{a.file.title}</bdi></Link> : <bdi>{a.title}</bdi>}
                    {a.file && <small className="muted">الموعد <span className="ltr">{fmtUtc(a.file.dueAt)}</span> · المرحلة: {a.file.stageLabelAr} · بانتظار {WAITING_AR[a.file.waitingOn] ?? "—"}{a.kind === "stalled" ? ` · بلا حركة منذ ${hoursPhrase(a.file.hoursSince)}` : ""}</small>}
                  </span>
                  <AlertActions companyId={d.company.id} alertId={a.id} status={a.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="inbox">
          <section className="card" aria-label="ملفات الطلبات">
            <div className="tabs" role="tablist">
              <Link role="tab" aria-selected={tab === "open"} className={tab === "open" ? "on" : ""} href="/requests">المفتوحة</Link>
              <Link role="tab" aria-selected={tab === "done"} className={tab === "done" ? "on" : ""} href="/requests?tab=done">المغلقة والملغاة</Link>
            </div>
            {list.length === 0 && <p className="muted">{tab === "open" ? "لا توجد ملفات طلبات مفتوحة. افتح ملفاً من إيميل داخل الوارد." : "لا توجد ملفات مغلقة بعد."}</p>}
            <ul className="list">
              {list.map((r) => (
                <li key={r.id} className={r.id === sel?.row.id ? "cur" : ""}>
                  <Link className="item" href={`/requests?id=${r.id}${tab === "done" ? "&tab=done" : ""}`} aria-current={r.id === sel?.row.id ? "true" : undefined}>
                    <b><Airline r={r} /> <bdi>{r.title}</bdi></b>
                    <small className="muted"><span className="ltr">{r.flightRef ?? "—"}</span> · {r.stageLabelAr}{r.urgent ? " · عاجل" : ""}</small>
                    <Progress stages={typeStages(r.type)} current={r.stage} status={r.status} />
                    <small className="muted">{r.status === "open" ? <>الموعد <span className="ltr">{fmtUtc(r.dueAt)}</span>{r.hoursToDue !== null && ` (${r.hoursToDue < 0 ? "متأخر " : "بعد "}${hoursPhrase(r.hoursToDue)})`}</> : <>آخر حدث <span className="ltr">{fmtUtc(r.lastEventAt)}</span></>}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="detail" aria-label="تفاصيل الطلب">
            {!sel && <div className="card"><p className="muted">اختر ملف طلب لعرض مراحله.</p></div>}
            {sel && (() => {
              const r = sel.row;
              const line = typeStages(r.type).filter((s) => s.code !== "cancelled");
              const cur = line.findIndex((s) => s.code === r.stage);
              return (<>
                <div className="card">
                  <div className="chips"><span className="tag info">{TYPE_AR[r.type] ?? r.type}</span><span className={`tag ${r.status === "open" ? "warn" : "ok"}`}>{r.status === "open" ? r.stageLabelAr : r.status === "closed" ? "اتقفل" : "اتلغى"}</span>{r.urgent && <span className="tag late">عاجل</span>}</div>
                  <h2><Airline r={r} /> <bdi>{r.title}</bdi></h2>
                  <p className="muted"><span className="ltr">{r.flightRef ?? "—"}</span> · رحلة <span className="ltr">{r.flightDate ?? "—"}</span></p>
                  <ol className="steps" aria-label="مراحل الطلب">
                    {line.map((s, i) => <li key={s.code} className={r.status === "cancelled" ? "" : i < cur || r.status === "closed" ? "done" : i === cur ? "now" : ""}>{s.labelAr}</li>)}
                  </ol>
                  {r.status === "open" && <>
                    <h3>الإجراء التالي</h3>
                    <p>{r.nextCustom ? <bdi className="ltr">{r.nextCustom}</bdi> : r.nextAr ?? "—"}</p>
                    <p className="muted">بانتظار: {WAITING_AR[r.waitingOn] ?? "—"}</p>
                    <RequestActions fileId={r.id} moves={moves} canClose={moves.some((m) => m.to === "closed")} />
                  </>}
                  <dl className="facts">
                    <div><dt>موعد الطلب</dt><dd className="ltr">{fmtUtc(r.dueAt)}</dd></div>
                    <div><dt>آخر حدث</dt><dd><span className="ltr">{fmtUtc(r.lastEventAt)}</span>{r.hoursSince !== null && <small className="muted">منذ {hoursPhrase(r.hoursSince)}</small>}</dd></div>
                    <div><dt>المسؤول</dt><dd>{r.ownerName ?? "غير مسند"}</dd></div>
                    <div><dt>الإيميلات المربوطة</dt><dd className="ltr">{r.messageCount}</dd></div>
                    {sel.permit && <div><dt>رقم التصريح</dt><dd className="ltr">{sel.permit.number ?? "—"}</dd></div>}
                  </dl>
                </div>

                <div className="card"><h2>الخط الزمني</h2>
                  <ol className="timeline">
                    {sel.timeline.map((t, i) => (
                      <li key={i}><i className="dot info" /><div><b>{t.toLabelAr ?? t.toStage}</b><small className="muted"><span className="ltr">{fmtUtc(t.at)}</span> · {ACTOR_AR[t.actor] ?? t.actor}</small>{t.note && <small className="ltr note">{t.note}</small>}</div></li>
                    ))}
                  </ol>
                </div>

                <div className="card"><h2>الإيميلات المربوطة</h2>
                  {sel.mails.length === 0 && <p className="muted">لا توجد إيميلات مربوطة.</p>}
                  <ul className="list">{sel.mails.map((m) => (
                    <li key={m.messageId}><span>{m.triageId ? <Link href={`/inbox?id=${m.triageId}`} className="ltr">{m.subject ?? "(no subject)"}</Link> : <bdi className="ltr">{m.subject ?? "(no subject)"}</bdi>}<small className="muted ltr">{m.from ?? ""} · {fmtUtc(m.at)}</small></span></li>))}</ul>
                </div>
              </>);
            })()}

            <div className="card"><h2>مهل بانتظار قرارك</h2>
              <p className="muted">لا يُولَّد تنبيه إلا بمهلة معتمدة. غير المعتمد يظهر «—» ولا أفترض له رقماً.</p>
              <ul className="list">{policies.map((p, i) => (
                <li key={i}><i className={`dot ${p.status === "approved" ? "ok" : "warn"}`} /><span>{POLICY_AR[p.kind] ?? p.kind}</span><b className="ltr">{p.hours === null ? "—" : `${p.hours}h`}</b><em className={`tag ${p.status === "approved" ? "ok" : "warn"}`}>{p.status === "approved" ? "معتمدة" : "بانتظار الاعتماد"}</em></li>))}</ul>
            </div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
