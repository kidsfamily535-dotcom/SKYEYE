// Stored-document search and delivery for the agent: company_files (which also holds every email attachment).
// Always scoped to the command's company. Links are signed URLs built here by code, never written by the model.

const AR_DOC: [RegExp, string][] = [
  [/شهاد/, "CERTIFICATE"],
  [/ضوضا/, "NOISE"],
  [/تسجيل/, "REGISTRATION"],
  [/صلاحي/, "AIRWORTHINESS"],
  [/تأمين|تامين/, "INSURANCE"],
  [/رخص/, "LICENSE"],
  [/تصريح|تصاريح/, "PERMIT"],
  [/جدول/, "SCHEDULE"],
  [/فاتور/, "INVOICE"],
  [/عقد/, "CONTRACT"],
  [/لاسلك/, "RADIO"],
  [/مسؤولي|مسئولي/, "LIABILITY"],
];

const FILE_INTENT = /(ملف|الملف|شهاد|مستند|وثيق|رخص|تصريح|عقد|فاتور|نسخ|هات|ابعت|اديني|حمل|تحميل|رابط|certificate|document|\bfile\b|\.pdf|\.docx|\.xlsx|permit|licen[cs]e|insurance|download|\blink\b|send me)/i;

// "give me / send me the file" (deliver the original file as it is) versus a question about what is written inside it.
const FILE_REQUEST = /(عاوز|عايز|هات|ابعت|اديني|نسخ|حمل|تحميل|رابط|download|send me|give me|\bcopy\b|\blink\b)/i;
const ABOUT_CONTENT = /(مكتوب|فيه ايه|فيها ايه|محتوا|محتوى|بيقول|بتقول|ينتهي|صالح|what does|\bsays\b|inside|content|valid until|expir)/i;
export const isFileRequest = (s: string) => FILE_REQUEST.test(s) && !ABOUT_CONTENT.test(s);

const STOP = new Set([
  "THE", "AND", "FOR", "FILE", "FILES", "PDF", "DOCX", "XLSX", "DOC", "SEND", "LINK", "DOWNLOAD", "WITH", "FROM",
  "THAT", "THIS", "HAVE", "GET", "GIVE", "NEED", "WANT", "SHOW", "UTC", "PLEASE", "COPY",
]);

export type FoundFile = {
  id: string;
  name: string;
  category: string | null;
  source: string | null;
  extraction_status: string | null;
  snippet: string | null;
  url: string | null;
  name_hits: number;
};

async function signRow(sb: any, r: any, hits: number): Promise<FoundFile> {
  let url: string | null = null;
  try {
    const s = await sb.storage.from(r.storage_bucket).createSignedUrl(r.storage_path, 3600, { download: r.name });
    url = s?.data?.signedUrl ?? null;
  } catch { /* the file is still listed without a link */ }
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? null,
    source: r.source ?? null,
    extraction_status: r.extraction_status ?? null,
    snippet: r.snippet ?? null,
    url,
    name_hits: hits,
  };
}

export async function findFiles(
  sb: any,
  companyId: string,
  instruction: string,
  regs: string[],
): Promise<{ ran: boolean; files: FoundFile[] }> {
  const up = instruction.toUpperCase();
  const toks = new Set<string>();
  for (const m of up.match(/[A-Z0-9]{3,}/g) ?? []) if (!STOP.has(m) && !/^\d+$/.test(m)) toks.add(m);
  for (const r of regs) {
    const c = r.replace(/[^A-Z0-9]/g, "");
    if (c.length >= 4) toks.add(c);
  }
  let docWords = 0;
  for (const [re, en] of AR_DOC) {
    if (re.test(instruction)) {
      toks.add(en);
      docWords++;
    }
  }
  if (!(FILE_INTENT.test(instruction) || docWords > 0) || toks.size === 0) return { ran: false, files: [] };

  const { data, error } = await sb.rpc("agent_find_files", {
    p_company: companyId,
    p_tokens: [...toks].slice(0, 12),
    p_limit: 3,
  });
  if (error) return { ran: false, files: [] };

  const files: FoundFile[] = [];
  for (const r of (data ?? []) as any[]) files.push(await signRow(sb, r, Number(r.name_hits ?? 0)));
  return { ran: true, files };
}

// A follow-up such as "send me a copy of it" has no file name: take the file of the previous answer in the same conversation.
export async function previousFile(
  sb: any,
  companyId: string,
  targetType: string,
  targetId: string | null,
  excludeId: string,
): Promise<FoundFile | null> {
  if (!targetId) return null;
  const { data } = await sb.from("agent_commands").select("result")
    .eq("company_id", companyId).eq("command_type", "answer_question").eq("target_type", targetType).eq("target_id", targetId)
    .eq("status", "done").neq("id", excludeId).order("created_at", { ascending: false }).limit(5);
  for (const row of (data ?? []) as any[]) {
    const id = (row.result?.files ?? []).map((f: any) => f?.id).find(Boolean);
    if (!id) continue;
    const { data: cf } = await sb.from("company_files")
      .select("id,name,category,source,extraction_status,storage_bucket,storage_path")
      .eq("company_id", companyId).eq("status", "active").eq("id", id).maybeSingle();
    if (cf) return await signRow(sb, cf, 0);
  }
  return null;
}
