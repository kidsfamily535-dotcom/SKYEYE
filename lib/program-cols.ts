// Column names the flight-program importer understands. Pure (no server imports) so the browser file reader can share it.
export type ProgramKey = "fn" | "stn" | "origin" | "dest" | "date" | "sta" | "std" | "dep" | "block_min" | "reg";

export const ALIASES: Record<ProgramKey, string[]> = {
  fn: ["fn", "flight", "flightno", "flightnumber", "flt", "رقمالرحلة", "الرحلة"],
  stn: ["stn", "station", "المحطة"],
  origin: ["origin", "from", "orig", "منمطار", "القدوم"],
  dest: ["dest", "to", "destination", "الوجهة"],
  date: ["date", "التاريخ"],
  sta: ["sta", "arrival", "arr", "الوصول"],
  std: ["std", "departure", "dep_time", "المغادرة"],
  dep: ["dep", "originstd", "origindep"],
  block_min: ["blockmin", "block", "blockminutes", "flighttime"],
  reg: ["reg", "registration", "tail", "التسجيل"],
};

export const norm = (s: string) => s.toLowerCase().replace(/[\s_\-./]/g, "");

const KNOWN = new Set(Object.values(ALIASES).flat().map(norm));
/** How many cells of a row look like known column names. */
export const headerHits = (cells: string[]) => new Set(cells.map(norm).filter((c) => KNOWN.has(c))).size;
