import * as XLSX from "@e965/xlsx";

const two = (n: number) => String(n).padStart(2, "0");
const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Excel stores dates/times as day numbers: 46327 = a date, 0.5833 = 14:00. Converted by hand so time zones never shift them. */
function serialToText(v: number): string {
  const whole = Math.floor(v);
  let mins = Math.round((v - whole) * 1440);
  let day = whole;
  if (mins >= 1440) { mins -= 1440; day += 1; }
  const hhmm = `${two(Math.floor(mins / 60))}:${two(mins % 60)}`;
  if (day < 1) return hhmm; // time-only cell
  const d = new Date(Date.UTC(1899, 11, 30) + day * 86400000);
  const date = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
  return mins ? `${date} ${hhmm}` : date;
}

/** Reads the first sheet of any spreadsheet file (xlsx, xls, ods, csv...) and returns the CSV text the paste box accepts. */
export function workbookToCsv(data: ArrayBuffer): string {
  const wb = XLSX.read(data, { type: "array", cellDates: false, cellNF: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws["!ref"]) return "";
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const lines: string[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || cell.v === null) { cells.push(""); continue; }
      if (cell.t === "n" && typeof cell.v === "number" && cell.z && XLSX.SSF.is_date(String(cell.z))) cells.push(serialToText(cell.v));
      else cells.push(csvCell(String(cell.t === "n" ? cell.v : cell.w ?? cell.v).trim()));
    }
    if (cells.some((x) => x !== "")) lines.push(cells.join(","));
  }
  return lines.join("\n");
}
