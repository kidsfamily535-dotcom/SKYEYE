/** Turns rows read from an Excel sheet into the same CSV text the paste box accepts. */
export function sheetToCsv(rows: unknown[][]): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) {
      // Excel stores a time-only cell as a date in 1899/1900 and a date-only cell at midnight UTC.
      if (v.getUTCFullYear() < 1950) return `${two(v.getUTCHours())}:${two(v.getUTCMinutes())}`;
      const d = `${v.getUTCFullYear()}-${two(v.getUTCMonth() + 1)}-${two(v.getUTCDate())}`;
      return v.getUTCHours() || v.getUTCMinutes() ? `${d} ${two(v.getUTCHours())}:${two(v.getUTCMinutes())}` : d;
    }
    const s = String(v).trim();
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== "")).map((r) => r.map(cell).join(",")).join("\n");
}
