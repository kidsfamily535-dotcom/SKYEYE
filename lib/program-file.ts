// Reads an uploaded file in the browser and turns it into the tab-separated table text that parseProgram() checks.
// Nothing is saved here: the employee still sees the text, presses "check", and the database re-validates every row.
import { headerHits } from "@/lib/program-cols";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 5000, MAX_COLS = 60;

const TEXT = ["csv", "tsv", "txt", "tab", "dat"];
const SHEET = ["xlsx", "xlsm", "xlsb", "xls", "ods"];
const HTML = ["html", "htm"];
export const FILE_ACCEPT = [...TEXT, ...SHEET, ...HTML, "docx", "pdf"].map((e) => `.${e}`).join(",");

export type ReadOut =
  | { ok: true; text: string; headerFound: boolean; sheet?: string; kind: "text" | "sheet" | "html" | "docx" | "pdf" }
  | { ok: false; reason: "unsupported" | "tooBig" | "empty" | "scanned" | "noTable" | "failed" };

const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase();
const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

/** Keeps the best header row (and everything under it), drops empty rows and trailing empty columns. */
function tidy(rows: string[][]): { text: string; headerFound: boolean } | null {
  const filled = rows.map((r) => r.map(clean)).filter((r) => r.some((c) => c !== ""));
  if (filled.length === 0) return null;
  let at = 0, best = 0;
  filled.slice(0, 30).forEach((r, i) => { const h = headerHits(r); if (h > best) { best = h; at = i; } });
  const headerFound = best >= 3;
  const body = headerFound ? filled.slice(at) : filled;
  const header = body[0].join("\t");
  // PDFs repeat the header on every page: keep only the first one.
  const lines = body.filter((r, i) => i === 0 || r.join("\t") !== header);
  const width = Math.min(MAX_COLS, Math.max(...lines.map((r) => r.reduce((w, c, k) => (c !== "" ? k + 1 : w), 0))));
  return { text: lines.map((r) => Array.from({ length: width }, (_, k) => r[k] ?? "").join("\t")).join("\n"), headerFound };
}

const score = (rows: string[][]) => Math.max(0, ...rows.slice(0, 30).map(headerHits));

function decode(buf: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1256").decode(buf); } // Arabic Excel CSVs are often saved this way
}

function splitCells(line: string, d: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (ch === '"') { if (q && line[k + 1] === '"') { cur += '"'; k++; } else q = !q; }
    else if (ch === d && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}

function fromText(buf: ArrayBuffer): ReadOut {
  const lines = decode(buf).replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ok: false, reason: "empty" };
  const delim = (l: string) => (l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",");
  let at = 0, best = 0;
  lines.slice(0, 30).forEach((l, i) => { const h = headerHits(splitCells(l, delim(l))); if (h > best) { best = h; at = i; } });
  const body = best >= 3 ? lines.slice(at) : lines;
  return { ok: true, text: body.join("\n"), headerFound: best >= 3, kind: "text" };
}

async function fromSheet(buf: ArrayBuffer): Promise<ReadOut> {
  const mod = await import("xlsx");
  const XLSX = (mod.SSF ? mod : (mod as unknown as { default: typeof mod }).default) as typeof mod;
  const wb = XLSX.read(buf, { type: "array", cellNF: true, cellText: false });
  let pick: { name: string; rows: string[][]; s: number } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]; if (!ws || !ws["!ref"]) continue;
    const rg = XLSX.utils.decode_range(ws["!ref"]);
    const rows: string[][] = [];
    for (let r = rg.s.r; r <= Math.min(rg.e.r, rg.s.r + MAX_ROWS); r++) {
      const row: string[] = [];
      for (let c = rg.s.c; c <= Math.min(rg.e.c, rg.s.c + MAX_COLS); c++) row.push(cellText(XLSX, ws[XLSX.utils.encode_cell({ r, c })]));
      rows.push(row);
    }
    const s = score(rows);
    if (!pick || s > pick.s || (s === pick.s && pick.rows.every((r) => r.every((c) => c === "")))) pick = { name, rows, s };
  }
  if (!pick) return { ok: false, reason: "empty" };
  const t = tidy(pick.rows); if (!t) return { ok: false, reason: "empty" };
  return { ok: true, ...t, sheet: wb.SheetNames.length > 1 ? pick.name : undefined, kind: "sheet" };
}

type XL = typeof import("xlsx");
const pad = (n: number) => String(n).padStart(2, "0");
/** Excel stores dates and times as numbers: turn them back into 2026-11-01 and 14:05 instead of 46327.58. */
function cellText(XLSX: XL, c: import("xlsx").CellObject | undefined): string {
  if (!c || c.v === undefined || c.v === null || c.t === "e" || c.t === "z") return "";
  if (c.t === "n" && typeof c.v === "number") {
    const v = c.v;
    const isDate = !!c.z && !!(XLSX.SSF as unknown as { is_date?: (f: string) => boolean }).is_date?.(String(c.z));
    if (v > 0 && v < 1 && (isDate || !Number.isInteger(v))) {
      const mins = Math.round(v * 1440);
      return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
    }
    if (isDate && v >= 1) {
      const d = XLSX.SSF.parse_date_code(v);
      const day = `${d.y}-${pad(d.m)}-${pad(d.d)}`;
      return d.H || d.M ? `${day} ${pad(d.H)}:${pad(d.M)}` : day;
    }
    return Number.isInteger(v) ? String(v) : String(+v.toFixed(6));
  }
  if (c.t === "b") return "";
  return String(c.v);
}

function tablesToRows(doc: Document): string[][] | null {
  let best: string[][] | null = null, bestScore = -1;
  doc.querySelectorAll("table").forEach((t) => {
    const rows = Array.from(t.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("th,td")).map((c) => c.textContent ?? ""));
    const s = score(rows.map((r) => r.map(clean)));
    if (rows.length && s > bestScore) { best = rows; bestScore = s; }
  });
  return best;
}

function fromHtmlString(html: string, kind: "html" | "docx"): ReadOut {
  const rows = tablesToRows(new DOMParser().parseFromString(html, "text/html"));
  if (!rows) return { ok: false, reason: "noTable" };
  const t = tidy(rows); if (!t) return { ok: false, reason: "empty" };
  return { ok: true, ...t, kind };
}

async function fromDocx(buf: ArrayBuffer): Promise<ReadOut> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
  return fromHtmlString(value, "docx");
}

/** PDF: rebuilds rows from the position of each piece of text (works for text PDFs, not scanned images). */
async function fromPdf(buf: ArrayBuffer): Promise<ReadOut> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const rows: string[][] = []; let chars = 0;
  for (let p = 1; p <= Math.min(doc.numPages, 200); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    type Piece = { s: string; x: number; y: number; w: number; h: number };
    const pieces: Piece[] = [];
    for (const it of content.items) {
      if (!("str" in it) || it.str.trim() === "") continue;
      chars += it.str.length;
      pieces.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.height) || Math.abs(it.transform[3]) || 8 });
    }
    pieces.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Piece[][] = [];
    for (const pc of pieces) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last[0].y - pc.y) <= Math.max(2, pc.h * 0.4)) last.push(pc); else lines.push([pc]);
    }
    for (const ln of lines) {
      ln.sort((a, b) => a.x - b.x);
      const cells: string[] = [ln[0].s];
      for (let k = 1; k < ln.length; k++) {
        const gap = ln[k].x - (ln[k - 1].x + ln[k - 1].w);
        if (gap > ln[k].h * 0.7) cells.push(ln[k].s); else cells[cells.length - 1] += (gap > ln[k].h * 0.15 ? " " : "") + ln[k].s;
      }
      rows.push(cells);
    }
  }
  if (chars < 20) return { ok: false, reason: "scanned" };
  const t = tidy(rows); if (!t) return { ok: false, reason: "empty" };
  return { ok: true, ...t, kind: "pdf" };
}

export async function readProgramFile(f: File): Promise<ReadOut> {
  const e = extOf(f.name);
  if (f.size > MAX_FILE_BYTES) return { ok: false, reason: "tooBig" };
  try {
    if (TEXT.includes(e)) return fromText(await f.arrayBuffer());
    if (SHEET.includes(e)) return await fromSheet(await f.arrayBuffer());
    if (HTML.includes(e)) return fromHtmlString(decode(await f.arrayBuffer()), "html");
    if (e === "docx") return await fromDocx(await f.arrayBuffer());
    if (e === "pdf") return await fromPdf(await f.arrayBuffer());
    return { ok: false, reason: "unsupported" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
