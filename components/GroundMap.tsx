"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OtpGantt from "@/components/OtpGantt";
import type { OtpState, OtpStep } from "@/lib/otp";

// Ground radar (OTP, handling-company side). View + live: every number comes from the DB (otp_radar -> turn_snapshot_v2).
// Service markers sit at the stand ONLY while a service is running (derived from the supervisor's start/end taps);
// there is no vehicle tracking (phones only), so nothing travels on the map.

type Snap = Extract<OtpState, { status: "ok" }>["snapshot"];
export type RadarTurn = { turn_id: string; flight_in: string | null; flight_out: string | null; registration: string | null; stand: string | null; body_class: string | null; is_demo: boolean; in_block_at: string; std: string | null; snapshot: Snap };
export type RadarNote = { id: string; turn_id: string | null; milestone_code: string | null; kind: string; severity: string; title: string; body: string | null; status: string; created_at: string };
export type Radar = { now: string; company_id: string; turns: RadarTurn[]; notifications: RadarNote[] };

const NS = { ar: {
  title: "الرادار الأرضي", live: "مباشر", search: "ابحث برقم الرحلة أو الموقف  ( / )", ground: "الرحلات على الأرض", stand: "الوقفة", delays: "تأخيرات الخدمات", notes: "الإشعارات",
  none: "لا رحلات على الأرض الآن.", noDelay: "لا تأخيرات حاليًا.", noNote: "لا إشعارات في آخر 24 ساعة.", left: "المتبقي من وقت الأرض المسموح", min: "د", target: "الإقلاع المستهدف", expected: "المتوقع",
  bay: "موقف", nobay: "بلا موقف", ok: "على الموعد", warn: "تأخر طفيف", bad: "متأخرة", idle: "بلا تقرير حديث", arr: "وصول", dep: "إقلاع مخطط", stale: "لا نشاط مسجّل منذ {n} د — القيم تقديرية حتى يسجّل المشرف خطوة جديدة.",
  done: "مكتمل", late: "مكتمل متأخر", run: "جارية", wait: "بانتظار التأكيد", plan: "مخطط", ontime: "في الوقت", over: "تجاوزت المخطط", planned: "المخطط حتى", started: "بدأت", demo: "تجريبي", refresh: "تحديث", asof: "آخر تحديث", zi: "تكبير", zo: "تصغير", fs: "ملء الشاشة", rs: "إعادة الضبط", map: "خريطة رصيف المحطة", hint: "خط متقطع = المخطط · مصمت = الفعلي · أحمر = تجاوز", crit: "حرج", warnS: "تحذير", info: "معلومة", flight: "الرحلة" },
en: {
  title: "Ground radar", live: "LIVE", search: "Search flight or stand  ( / )", ground: "Flights on the ground", stand: "Stand", delays: "Service delays", notes: "Notifications",
  none: "No flights on the ground now.", noDelay: "No delays right now.", noNote: "No notifications in the last 24 h.", left: "Allowed ground time left", min: "m", target: "Target departure", expected: "Expected",
  bay: "Stand", nobay: "No stand", ok: "On time", warn: "Slightly late", bad: "Late", idle: "No recent report", arr: "Arrived", dep: "Planned dep.", stale: "No activity recorded for {n} min — values are estimates until the supervisor records a new step.",
  done: "Done", late: "Done late", run: "Running", wait: "Awaiting confirmation", plan: "Planned", ontime: "On time", over: "Over plan", planned: "Planned until", started: "Started", demo: "Demo", refresh: "Refresh", asof: "Updated", zi: "Zoom in", zo: "Zoom out", fs: "Fullscreen", rs: "Reset", map: "Stand map", hint: "dashed = planned · solid = recorded · red = over", crit: "Critical", warnS: "Warning", info: "Info", flight: "Flight" } } as const;

const VC: Record<string, { c: string; x: number; y: number }> = {
  deboard: { c: "#4C8DFF", x: -16, y: 124 }, bags_unload: { c: "#B18CFF", x: 16, y: 162 }, cleaning: { c: "#35C2C2", x: 16, y: 128 },
  catering: { c: "#FF8A5B", x: -16, y: 176 }, fuel: { c: "#E9E9E9", x: 48, y: 146 }, bags_load: { c: "#B18CFF", x: 16, y: 166 }, boarding: { c: "#FFC107", x: -16, y: 124 },
};
const PL = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";
const hm = (v: string | number | null | undefined) => (v ? new Date(v).toISOString().slice(11, 16) : "—");
const ms = (v: string | null | undefined) => (v ? +new Date(v) : null);
const own = (s: OtpStep) => s.late_vs_plan_min ?? 0;
type Tone = "ok" | "warn" | "bad" | "idle";

function lastActivity(t: RadarTurn): number {
  const xs = t.snapshot.steps.flatMap((s) => [ms(s.actual_end), ms(s.actual_start)]).filter((v): v is number => v !== null);
  return Math.max(+new Date(t.in_block_at), ...xs);
}
function toneOf(t: RadarTurn, now: number): Tone {
  const g = t.snapshot.ground;
  const done = t.snapshot.steps.every((s) => s.step_state === "done" || s.step_state === "done_late");
  if (!done && now - lastActivity(t) > 30 * 60000) return "idle";
  const over = Math.max(g.projected_overshoot_min ?? 0, (g.minutes_left ?? 0) < 0 ? -(g.minutes_left ?? 0) : 0);
  return over >= 5 ? "bad" : over > 0 ? "warn" : "ok";
}
const stepName = (s: OtpStep) => s.step_name_ar ?? s.step_code;

export default function GroundMap({ data, lang }: { data: Radar; lang: "ar" | "en" }) {
  const L = NS[lang];
  const router = useRouter();
  const [now, setNow] = useState(() => +new Date(data.now));
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({ g: true, sel: true, dl: true, nt: true });
  const stage = useRef<HTMLDivElement>(null);
  const qi = useRef<HTMLInputElement>(null);

  const active = useMemo(() => data.turns.filter((t) => t.snapshot.ground.state !== "completed" && t.snapshot.ground.state !== "awaiting_chocks_on"), [data.turns]);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = active.find((t) => t.turn_id === selId) ?? active[0] ?? null;

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, []);
  useEffect(() => { const i = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) router.refresh(); }, 60000); return () => clearInterval(i); }, [router]);
  useEffect(() => { setNow(+new Date(data.now)); }, [data.now]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement !== qi.current) { e.preventDefault(); qi.current?.focus(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const W = Math.max(740, active.length * 160 + 60), SX = active.map((_, i) => 110 + i * 160);
  const idx = sel ? active.indexOf(sel) : -1;
  const cx = zoom > 1 && idx >= 0 ? SX[idx] : W / 2, cy = zoom > 1 && idx >= 0 ? 150 : 220;
  const vw = W / zoom, vh = 440 / zoom;
  const label = (t: RadarTurn) => [t.flight_in, t.flight_out].filter(Boolean).join("/") || "—";
  const bayName = (t: RadarTurn) => (t.stand ? `${L.bay} ${t.stand}` : L.nobay);
  const needle = q.trim().toLowerCase();
  const shown = active.filter((t) => !needle || (label(t) + " " + (t.stand ?? "") + " " + (t.registration ?? "")).toLowerCase().includes(needle));
  const TL: Record<Tone, string> = { ok: L.ok, warn: L.warn, bad: L.bad, idle: L.idle };
  const stepTag = (s: OtpStep) => ({ done: [L.done, "k"], done_late: [L.late, "e"], in_window: [L.run, "g"], overdue_unconfirmed: [L.wait, "e"], upcoming: [L.plan, ""] } as const)[s.step_state];

  const delays = active.flatMap((t) => t.snapshot.steps.filter((s) => s.step_code !== "ground_start" && s.step_state !== "upcoming" && (s.late_vs_plan_min ?? 0) >= 3 && s.step_state !== "done").map((s) => ({ t, s })));
  const noteTone = (k: string) => (k === "critical" ? L.crit : k === "warn" ? L.warnS : L.info);
  const fakeState = (t: RadarTurn): OtpState => ({ status: "ok", turn_id: t.turn_id, is_demo: t.is_demo, warning: null, names: {}, events: [], starts: [], delays: [], snapshot: t.snapshot });

  const sec = (k: string, title: string, body: React.ReactNode, live?: boolean) => (
    <section className="sc"><button className="sh" aria-expanded={!!open[k]} onClick={() => setOpen({ ...open, [k]: !open[k] })}><b>{title}</b>{live && <span className="live">{L.live}</span>}
      <svg className="chev" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></svg></button>{open[k] && <div className="sb">{body}</div>}</section>);

  const g = sel?.snapshot.ground;
  const selTone = sel ? toneOf(sel, now) : "ok";
  const left = g?.minutes_left ?? null;

  return (
    <div className="gm" ref={stage}>
      <svg className="gm-map" viewBox={`${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={L.map}>
        <defs><filter id="gmnz" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 -.1" /></filter></defs>
        <rect x="-300" y="-200" width={W + 600} height="840" fill="var(--map)" /><rect x="-300" y="-200" width={W + 600} height="840" filter="url(#gmnz)" opacity=".35" />
        <rect x="8" y="6" width={W - 16} height="306" rx="6" fill="var(--ap)" opacity=".9" />
        <rect x="20" y="10" width={W - 40} height="42" rx="4" fill="var(--tx)" />
        <rect x="-300" y="262" width={W + 600} height="16" fill="var(--tx)" /><line x1="-300" y1="270" x2={W + 300} y2="270" stroke="#E5B800" strokeWidth="1.2" strokeDasharray="10 8" />
        {active.map((t, i) => (<g key={t.turn_id}>
          <rect x={SX[i] - 66} y="66" width="132" height="166" rx="4" fill="none" stroke="rgba(255,255,255,.35)" strokeDasharray="4 4" />
          <line x1={SX[i]} y1="52" x2={SX[i]} y2="96" stroke="var(--tx)" strokeWidth="4" />
          <text x={SX[i]} y="82" textAnchor="middle" className="ml">{bayName(t)}</text></g>))}
        {sel && idx >= 0 && <circle cx={SX[idx]} cy="150" r="46" fill="none" stroke="#fff" strokeWidth="1.4" />}
        {active.map((t, i) => { const tone = toneOf(t, now); return (
          <g key={t.turn_id} transform={`translate(${SX[i]},150)`} style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-label={`${L.flight} ${label(t)}`} onClick={() => setSelId(t.turn_id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelId(t.turn_id); }}>
            <g transform="scale(.85)"><path d={PL} fill="#FFC107" stroke="#000" strokeOpacity=".65" strokeWidth="1.5" strokeDasharray={tone === "idle" ? "4 3" : undefined} /></g>
            <g transform="translate(44,-8)"><rect x="0" y="-11" width={Math.max(68, label(t).length * 7 + 22)} height="20" rx="3" fill="rgba(20,20,20,.85)" /><circle cx="9" cy="-1" r="4" fill={`var(--${tone})`} /><text x="18" y="3" fill="#fff" fontSize="11" fontWeight="700">{label(t)}</text></g></g>); })}
        {active.flatMap((t, i) => t.snapshot.steps.filter((s) => s.step_state === "in_window" && VC[s.step_code]).map((s) => { const v = VC[s.step_code];
          return <g key={t.turn_id + s.step_code} transform={`translate(${SX[i] + v.x},${v.y})`}><rect x="-8" y="-5" width="16" height="10" rx="2" fill={v.c} stroke="#000" strokeOpacity=".5" /></g>; }))}
        <text x={W - 14} y="262" textAnchor="end" className="ml">{lang === "ar" ? "ممر الطائرات" : "Taxiway"}</text>
      </svg>

      <div className="gm-tp"><div className="logo"><svg viewBox="-40 -40 80 80" aria-hidden="true"><path d={PL} fill="var(--y)" /></svg><span>{L.title}</span></div>
        <input ref={qi} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} />{active.some((t) => t.is_demo) && <span className="pill2">{L.demo}</span>}</div>
      <div className="gm-zc">
        <button aria-label={L.zi} onClick={() => setZoom((z) => Math.min(3.5, z * 1.4))}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>
        <button aria-label={L.zo} onClick={() => setZoom((z) => Math.max(1, z / 1.4))}><svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg></button>
        <button aria-label={L.fs} onClick={() => { const s = stage.current; if (document.fullscreenElement) document.exitFullscreen(); else s?.requestFullscreen?.(); }}><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg></button>
        <button aria-label={L.rs} onClick={() => setZoom(1)}><svg viewBox="0 0 24 24"><path d="M21 3L3 11l7 3 3 7z" /></svg></button>
      </div>
      <div className="gm-lg">{[["#4C8DFF", lang === "ar" ? "نزول" : "Deboard"], ["#B18CFF", lang === "ar" ? "حقائب" : "Bags"], ["#35C2C2", lang === "ar" ? "نظافة" : "Cleaning"], ["#FF8A5B", lang === "ar" ? "تموين" : "Catering"], ["#E9E9E9", lang === "ar" ? "وقود" : "Fuel"], ["#FFC107", lang === "ar" ? "صعود" : "Boarding"]].map(([c, n]) => <span key={n}><i style={{ background: c }} />{n}</span>)}</div>

      <aside className="gm-panel">
        {sec("g", L.ground, shown.length ? shown.map((t, n) => { const tone = toneOf(t, now), etd = ms(t.snapshot.ground.projected_off_block ?? t.snapshot.ground.target_departure);
          return (<button key={t.turn_id} className="cd" style={t === sel ? { outline: "1.5px solid var(--y)" } : undefined} onClick={() => setSelId(t.turn_id)}>
            <div className="r1"><span className="n">{n + 1}. {label(t)}</span><span className="pl">{bayName(t)}</span><span className={`pl ${tone === "ok" ? "k" : tone === "idle" ? "" : "e"}`}>{TL[tone]}</span><span className="rt" style={{ color: `var(--${tone})` }}>{hm(etd)}</span></div>
            <div className="s2">{L.arr} {hm(t.in_block_at)} — {L.dep} {hm(t.std)}</div></button>); }) : <div className="s2">{L.none}</div>, true)}
        {sel && g && sec("sel", `${L.stand} — ${label(sel)}`, <>
          {g.minutes_left !== null && <div className="cd big"><span className="s2">{L.left}</span><b style={{ color: `var(--${left! < 0 ? "bad" : left! < 10 ? "warn" : "ok"})` }}>{left! < 0 ? "+" + Math.round(-left!) : Math.round(left!)} {L.min}</b>
            <div className="s2">{L.target} {hm(g.target_departure ?? g.original_std)}{g.projected_off_block ? ` · ${L.expected} ${hm(g.projected_off_block)}` : ""}</div></div>}
          {selTone === "idle" && <div className="warnb">{L.stale.replace("{n}", String(Math.round((now - lastActivity(sel)) / 60000)))}</div>}
          <div className="cd"><div className="gm-gantt" dir="ltr"><OtpGantt otp={fakeState(sel)} nowMs={now} lang={lang} /></div><div className="s2" style={{ fontSize: 11 }}>{L.hint}</div></div>
          {sel.snapshot.steps.filter((s) => s.step_code !== "ground_start").map((s, n) => { const [tag, cls] = stepTag(s); const late = own(s); const over = s.step_state !== "done" && s.step_state !== "upcoming" && late >= 3;
            return (<div className="cd" key={s.step_code}><div className="r1"><span className="n" style={{ fontSize: 15 }}>{n + 1}. {stepName(s)}</span><span className={`pl ${cls}`}>{tag}</span>
              <span className="rt" style={{ color: over ? "var(--bad)" : s.step_state === "upcoming" ? "var(--y)" : "var(--ok)" }}>{s.step_state === "upcoming" ? "" : over ? `+${late} ${L.min}` : L.ontime}</span></div>
              <div className="s2">{s.actual_end ? `${s.actual_start ? hm(s.actual_start) + " – " : ""}${hm(s.actual_end)}` : s.actual_start ? `${L.started} ${hm(s.actual_start)} · ${L.planned} ${hm(s.planned_end)}` : `${L.planned} ${hm(s.planned_end)}`}</div></div>); })}
        </>)}
        {sec("dl", L.delays, delays.length ? delays.map(({ t, s }) => (<div className="cd" key={t.turn_id + s.step_code}><div className="r1"><span className="n" style={{ fontSize: 15 }}>{stepName(s)}</span><span className="pl">{label(t)}</span><span className="rt" style={{ color: "var(--bad)" }}>+{s.late_vs_plan_min} {L.min}</span></div><div className="s2">{L.planned} {hm(s.planned_end)}</div></div>)) : <div className="s2">{L.noDelay}</div>, true)}
        {sec("nt", L.notes, data.notifications.length ? data.notifications.slice(0, 12).map((n) => (<div className="cd" key={n.id}><div className="r1"><span className={`pl ${n.severity === "critical" ? "e" : ""}`}>{noteTone(n.severity)}</span><span className="rt s2">{hm(n.created_at)}</span></div><div className="s2" style={{ margin: 0 }}><b style={{ color: "var(--ink)" }}>{n.title}</b>{n.body ? ` — ${n.body}` : ""}</div></div>)) : <div className="s2">{L.noNote}</div>, true)}
      </aside>

      <div className="gm-tb"><span className="live">{L.live}</span><span className="clk">{hm(now)} UTC</span><span className="s2">{L.asof} {hm(data.now)}</span><button onClick={() => router.refresh()}>{L.refresh}</button></div>
    </div>
  );
}
