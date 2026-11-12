// Email lookup for the agent chat: find stored emails by sender / date / subject words / flight number, with their attachments.
// Read-only and always scoped to the command's company (public.agent_find_emails). Links are signed URLs built here by code.

const EMAIL_INTENT = /(ايميل|إيميل|الايميل|الإيميل|ميل|\be-?mails?\b|\bmails?\b|inbox|الوارد|\bfwd\b|forwarded)/i;
export const isEmailRequest = (s: string) => EMAIL_INTENT.test(s);

// Asking what is written INSIDE an email (needs the model) versus asking to find it / get its attachments (answered by code).
const ABOUT_CONTENT = /(لخص|لخّص|ملخص|تلخيص|مكتوب|فيه ايه|فيها ايه|بيقول|بتقول|استخرج|summar|what does|\bsays\b|inside|content|extract)/i;
export const wantsEmailContent = (s: string) => ABOUT_CONTENT.test(s);

const STOP = new Set([
  "THE", "AND", "FOR", "FROM", "WITH", "THAT", "THIS", "HAVE", "SEND", "GIVE", "SHOW", "FIND", "GET", "NEED", "WANT",
  "EMAIL", "EMAILS", "MAIL", "MAILS", "INBOX", "FILE", "FILES", "PDF", "DOCX", "XLSX", "ATTACHMENT", "ATTACHMENTS",
  "PLEASE", "TODAY", "YESTERDAY", "SENT", "RECEIVED", "SUBJECT", "ABOUT", "UTC", "COM", "NET", "ORG", "FWD",
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]);

const MONTHS: [RegExp, number][] = [
  [/(يناير|jan)/i, 1], [/(فبراير|feb)/i, 2], [/(مارس|mar)/i, 3], [/(ابريل|أبريل|apr)/i, 4], [/(مايو|may)/i, 5], [/(يونيو|jun)/i, 6],
  [/(يوليو|jul)/i, 7], [/(اغسطس|أغسطس|aug)/i, 8], [/(سبتمبر|sep)/i, 9], [/(اكتوبر|أكتوبر|oct)/i, 10], [/(نوفمبر|nov)/i, 11], [/(ديسمبر|dec)/i, 12],
];

const DAY = 86_400_000;
const dayStart = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const validDay = (y: number, m: number, d: number) => {
  const t = new Date(dayStart(y, m, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Dates are UTC days, like every time in the system. Returns [from, to) or null when the sentence names no date. */
export function parseDateRange(s: string, now = new Date()): { from: string; to: string; label: string } | null {
  const y0 = now.getUTCFullYear();
  const today = dayStart(y0, now.getUTCMonth() + 1, now.getUTCDate());
  const mk = (t: number, label: string) => ({ from: new Date(t).toISOString(), to: new Date(t + DAY).toISOString(), label });
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso && validDay(+iso[1], +iso[2], +iso[3])) return mk(dayStart(+iso[1], +iso[2], +iso[3]), `${iso[1]}-${iso[2]}-${iso[3]}`);
  if (/(النهارده|النهاردة|انهارده|اليوم|\btoday\b)/i.test(s)) return mk(today, "today");
  if (/(امبارح|إمبارح|أمس|\byesterday\b)/i.test(s)) return mk(today - DAY, "yesterday");
  const dm = s.match(/\b(\d{1,2})\s*(?:[\/.]|\s)\s*(يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (dm) {
    const mo = MONTHS.find(([re]) => re.test(dm[2]))?.[1];
    if (mo && validDay(y0, mo, +dm[1])) return mk(dayStart(y0, mo, +dm[1]), `${dm[1]}/${mo}`);
  }
  const num = s.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (num) {
    const d = +num[1], m = +num[2];
    let y = num[3] ? +num[3] : y0;
    if (y < 100) y += 2000;
    if (validDay(y, m, d)) return mk(dayStart(y, m, d), `${d}/${m}/${y}`);
  }
  return null;
}

export type EmailQuery = { tokens: string[]; from: string | null; direction: "inbound" | "outbound" | null; range: ReturnType<typeof parseDateRange> };

export function parseEmailQuery(instruction: string, regs: string[] = [], now = new Date()): EmailQuery {
  let text = instruction;
  let from: string | null = null;
  const addr = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (addr) { from = addr[0]; text = text.replace(addr[0], " "); }
  else {
    const w = text.match(/(?:^|\s)(?:من|from)\s+([A-Za-z][A-Za-z0-9._-]{2,})/i); // no \b: it does not work with Arabic letters
    if (w && !STOP.has(w[1].toUpperCase())) { from = w[1]; text = text.replace(w[0], " "); }
  }
  const range = parseDateRange(text, now);
  const direction = /(صادر|اللي بعتناه|اللي بعتناها|بعتنا|\boutbound\b|\bsent\b)/i.test(text) ? "outbound"
    : /(وارد|جاتلي|جالنا|وصلتنا|\binbound\b|\breceived\b)/i.test(text) ? "inbound" : null;
  const stripped = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?\b/g, " ");
  const toks = new Set<string>();
  for (const m of stripped.toUpperCase().match(/[A-Z0-9]{3,}/g) ?? []) if (!STOP.has(m) && !/^\d+$/.test(m)) toks.add(m);
  for (const r of regs) { const c = r.replace(/[^A-Z0-9]/gi, "").toUpperCase(); if (c.length >= 4) toks.add(c); }
  return { tokens: [...toks].slice(0, 10), from, direction, range };
}

export type EmailAttachment = { name: string; file_id: string | null; extraction_status: string | null; url: string | null };
export type FoundEmail = {
  id: string; direction: string | null; from: string | null; subject: string | null; sent_at: string | null;
  snippet: string; score: number; attachments: EmailAttachment[];
};

export async function findEmails(
  sb: any,
  companyId: string,
  instruction: string,
  regs: string[],
): Promise<{ ran: boolean; query: EmailQuery; emails: FoundEmail[] }> {
  const query = parseEmailQuery(instruction, regs);
  // A search needs something to search by: a sender, a day or at least one subject word / flight number.
  if (!query.from && !query.range && query.tokens.length === 0) return { ran: false, query, emails: [] };
  const { data, error } = await sb.rpc("agent_find_emails", {
    p_company: companyId,
    p_tokens: query.tokens,
    p_from: query.from,
    p_date_from: query.range?.from ?? null,
    p_date_to: query.range?.to ?? null,
    p_direction: query.direction,
    p_limit: 3,
  });
  if (error) return { ran: false, query, emails: [] };

  const rows = (data ?? []) as any[];
  const ids = [...new Set(rows.flatMap((r) => (r.attachments ?? []).map((a: any) => a?.file_id).filter(Boolean)))] as string[];
  const stored = new Map<string, any>();
  if (ids.length) {
    const { data: cf } = await sb.from("company_files").select("id,name,storage_bucket,storage_path")
      .eq("company_id", companyId).eq("status", "active").in("id", ids);
    for (const f of (cf ?? []) as any[]) stored.set(f.id, f);
  }
  const emails: FoundEmail[] = [];
  for (const r of rows) {
    const atts: EmailAttachment[] = [];
    for (const a of ((r.attachments ?? []) as any[]).slice(0, 6)) {
      const f = a?.file_id ? stored.get(a.file_id) : null;
      let url: string | null = null;
      if (f) {
        try {
          const s = await sb.storage.from(f.storage_bucket).createSignedUrl(f.storage_path, 3600, { download: f.name });
          url = s?.data?.signedUrl ?? null;
        } catch { /* listed without a link */ }
      }
      atts.push({ name: String(a?.filename ?? f?.name ?? ""), file_id: a?.file_id ?? null, extraction_status: a?.extraction_status ?? null, url });
    }
    emails.push({
      id: r.id, direction: r.direction ?? null, from: r.from_address ?? null, subject: r.subject ?? null,
      sent_at: r.sent_at ?? null, snippet: String(r.snippet ?? ""), score: Number(r.score ?? 0), attachments: atts,
    });
  }
  return { ran: true, query, emails };
}

const oneLine = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** The answer for "find / show me the email / its attachment": built by code, so nothing is invented. */
export function formatEmails(emails: FoundEmail[], query: EmailQuery): string {
  const by = [
    query.from ? `المرسل ${query.from}` : null,
    query.range ? `يوم ${query.range.label}` : null,
    query.tokens.length ? `الكلمات ${query.tokens.join(" ")}` : null,
  ].filter(Boolean).join("، ");
  if (!emails.length) return `دورت في إيميلات الشركة (${by || "بدون شروط"}) وملقتش إيميل مطابق. جرّب مرسل أو تاريخ أو رقم رحلة تاني.`;
  const lines: string[] = [`لقيت ${emails.length} إيميل (${by}):`];
  emails.forEach((e, i) => {
    const when = e.sent_at ? new Date(e.sent_at).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "";
    const dir = e.direction === "outbound" ? "صادر" : "وارد";
    lines.push(`\n${i + 1}) ${oneLine(e.subject ?? "(بدون موضوع)", 120)}\n   ${dir} · من ${e.from ?? "?"} · ${when}`);
    if (e.snippet) lines.push(`   بداية النص: ${oneLine(e.snippet, 160)}`);
    if (e.attachments.length) {
      lines.push("   المرفقات:");
      for (const a of e.attachments) lines.push(a.url ? `   - ${a.name}: ${a.url}` : `   - ${a.name} (مفيش رابط متاح دلوقتي)`);
    } else lines.push("   مفيش مرفقات.");
  });
  lines.push("\nالروابط صالحة لمدة ساعة. لو عايز ملخص لإيميل معيّن اكتب «لخّص الإيميل» مع موضوعه.");
  return lines.join("\n");
}
