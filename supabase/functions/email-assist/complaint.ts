// Complaint handling for email-assist. Pure functions only (no Deno/DB), so they can be unit-tested.
// Rules (owner decisions): the agent never admits, denies, apologises or mentions compensation.
// The immediate reply = receipt + "investigation started" only. Nothing is guessed or invented.

// Strong complaint signals only. Words like "lost", "missing", "claim" alone are NOT used:
// they appear in normal emails ("missing documents", "baggage claim") and would raise false alarms.
const COMPLAINT_RE =
  /\b(complaint|complaints|complain|complained|compensation|investigation|investigate|misconduct)\b|شكوى|شكاوى|تعويض|تحقيق/i;

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const DATE_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})[a-z]*\\.?(?:,?\\s+(\\d{4}))?`, "i");
// Candidate flight numbers: 2-char airline code (at least one letter) + 3-4 digits, e.g. J9-742, 8U431.
const FLIGHT_RE = /\b([A-Z][A-Z0-9]|[0-9][A-Z])[\s-]?(\d{3,4})\b/g;
// Units / words that look like a flight code but are not (e.g. "KG 3080", "ID 1234").
const NOT_AIRLINE = new Set(["KG", "LB", "ID", "PC", "NO", "EG", "US", "AM", "PM", "TO", "EP"]);
const PNR_RE = /\bPNR[:\s#-]*([A-Z0-9]{5,7})\b/i;
const ETKT_RE = /\b(?:ETKT|E-?TICKET)[:\s#-]*(\d{13})\b/i;

export function isComplaint(subject: string, text: string): boolean {
  return COMPLAINT_RE.test(subject + "\n" + text);
}

export type Extracted = {
  flights: string[]; // candidates, unverified
  date: string | null; // as written
  year_missing: boolean;
  pnr: string | null;
  ticket: string | null;
};

export function extractFacts(subject: string, text: string): Extracted {
  const all = subject + "\n" + text;
  const flights = [
    ...new Set(
      [...all.toUpperCase().matchAll(FLIGHT_RE)]
        .filter((m) => !NOT_AIRLINE.has(m[1]))
        .map((m) => m[0].replace(/\s+/g, "")),
    ),
  ].slice(0, 3);
  const d = all.match(DATE_RE);
  const pnr = all.match(PNR_RE)?.[1]?.toUpperCase() ?? null;
  const tk = all.match(ETKT_RE)?.[1] ?? null;
  return {
    flights,
    date: d ? d[0].replace(/[.,\s]+$/, "") : null,
    year_missing: d ? !d[3] : false,
    pnr,
    ticket: tk,
  };
}

// Arabic summary for the employee. Only what was found; everything else is explicitly "unknown".
export function complaintSummary(x: Extracted): string {
  const lines = ["شكوى: تحتاج مراجعة المشرف قبل أي رد جوهري."];
  lines.push(
    x.flights.length
      ? `رحلة محتملة: ${x.flights.join(" / ")} (الربط بالرحلة غير مؤكد، تأكد منها).`
      : "الرحلة: غير معروفة (اسأل الموظف).",
  );
  lines.push(x.date ? `التاريخ كما ورد: ${x.date}.` : "التاريخ: غير معروف.");
  if (x.year_missing) lines.push("السنة غير مذكورة: لا تخمّن، اسأل الموظف.");
  if (x.pnr) lines.push(`PNR: ${x.pnr}.`);
  if (x.ticket) lines.push(`تذكرة: ${x.ticket}.`);
  lines.push("كل معلومة في الشكوى تُعتبر ادعاءً حتى يؤكدها سجل.");
  return lines.join("\n");
}

const ARABIC = /[\u0600-\u06FF]/;

// Immediate reply: receipt + investigation started. No admission, denial, apology or compensation.
export function complaintImmediateDraft(subject: string) {
  const s = subject.trim();
  const clean = !s || ARABIC.test(s) ? "your message" : s.replace(/^re:\s*/i, "");
  return {
    subject: `RE: ${clean}`,
    body: [
      "Dear Colleagues,",
      "",
      `CONFIRM RECEIVED your message "${clean}".`,
      "The matter has been referred to the responsible team and an investigation has started.",
      "We will revert once the facts have been verified.",
      "",
      "Best regards,",
      "Operations",
    ].join("\n"),
  };
}
