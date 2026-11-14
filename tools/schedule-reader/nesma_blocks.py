"""
New schedule reader (does not touch the old one).
Layout handled: "aircraft blocks" (Nesma weekly schedule): one row-group per day (merged column A),
one 8-column block per aircraft (header like "SU-NMF Seat:179 / Block Hour:59:40" merged over the block).
Anything it cannot place is reported as a warning, never guessed.
All times in the file are treated as UTC (decision of 2026-11-14).
"""
import re, datetime as dt, json, sys
from openpyxl import load_workbook

HDR_RE = re.compile(r"^\s*([A-Z0-9]{1,2}-[A-Z0-9]{3,4})\s+Seat:(\d+)\s*/\s*Block Hour:(\d+):(\d{2})\s*$")
DAY_RE = re.compile(r"^\s*(\d{1,2})\s+([A-Za-z]{3})\s+([A-Za-z]{3})\s*$")
FLT_RE = re.compile(r"^\s*([A-Z0-9]{2})\s*(\d{1,4})\s*(/F)?\s*$")
APT_RE = re.compile(r"^[A-Z]{3}$")
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")
MON = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
WDAY = "Mon Tue Wed Thu Fri Sat Sun".split()


def s(v):
    if v is None: return ""
    if isinstance(v, dt.time): return v.strftime("%H:%M")
    return str(v).strip()


def detect_layout(ws):
    hits = sum(1 for r in ws.merged_cells.ranges if r.min_row <= 3 and HDR_RE.match(s(ws.cell(r.min_row, r.min_col).value)))
    return "aircraft_blocks" if hits >= 2 else "unknown"


def read(path):
    wb = load_workbook(path)
    ws = wb.active
    out = {"layout": detect_layout(ws), "legs": [], "notes": [], "warnings": [], "aircraft": {}, "meta": {}}
    if out["layout"] != "aircraft_blocks":
        out["warnings"].append("layout_unknown: no aircraft block headers found; nothing was read")
        return out
    # year from the 'Created at: dd.mm.yyyy' line
    head = " ".join(s(c.value) for c in ws[1] if c.value)
    m = re.search(r"Created at:\s*(\d{2})\.(\d{2})\.(\d{4})", head)
    year = int(m.group(3)) if m else None
    wk = re.search(r"WEEK\s*(\d+)\s*REVISION\s*(\d+)", head)
    out["meta"] = {"year": year, "week": int(wk.group(1)) if wk else None, "revision": int(wk.group(2)) if wk else None, "time_basis": "UTC"}
    if not year: out["warnings"].append("year_missing: could not read year from header")

    # aircraft blocks from header row merges
    blocks = []
    for r in ws.merged_cells.ranges:
        txt = s(ws.cell(r.min_row, r.min_col).value)
        mm = HDR_RE.match(txt) if r.min_row <= 3 else None
        if mm:
            blocks.append({"reg": mm.group(1), "seats": int(mm.group(2)), "hdr_block_min": int(mm.group(3)) * 60 + int(mm.group(4)),
                           "c0": r.min_col, "width": r.max_col - r.min_col + 1})
    blocks.sort(key=lambda b: b["c0"])
    if any(b["width"] != 8 for b in blocks): out["warnings"].append("block_width: some blocks are not 8 columns wide; check manually")

    # day groups from merged column A
    days = []
    for r in ws.merged_cells.ranges:
        if r.min_col == 1 and r.max_col == 1 and r.min_row > 2:
            mm = DAY_RE.match(s(ws.cell(r.min_row, 1).value))
            if mm:
                d, mon, wd = int(mm.group(1)), MON.get(mm.group(2)), mm.group(3)
                date = None
                for y in ([year] if year else []) + [(year or 0) + 1, (year or 0) - 1]:
                    try:
                        cand = dt.date(y, mon, d)
                    except Exception:
                        continue
                    if WDAY[cand.weekday()] == wd: date = cand; break
                if not date: out["warnings"].append(f"day_unresolved: '{s(ws.cell(r.min_row,1).value)}' weekday does not match any nearby year")
                days.append({"r0": r.min_row, "r1": r.max_row, "date": date})
    days.sort(key=lambda x: x["r0"])

    # merged cells inside blocks (notes spanning several columns)
    merged = {}
    for r in ws.merged_cells.ranges:
        if r.min_row > 2 and r.min_col > 1:
            merged[(r.min_row, r.min_col)] = r
    for dg in days:
        if not dg["date"]: continue
        for row in range(dg["r0"], dg["r1"] + 1):
            for b in blocks:
                c0 = b["c0"]
                cells = [ws.cell(row, c0 + k).value for k in range(8)]
                if all(s(x) == "" for x in cells): continue
                f = s(cells[0])
                mm = FLT_RE.match(f)
                if not mm:
                    out["notes"].append({"reg": b["reg"], "date": dg["date"].isoformat(), "row": row, "text": " | ".join(s(x) for x in cells if s(x))})
                    continue
                frm, to, std, sta = s(cells[1]), s(cells[2]), s(cells[3]), s(cells[4])
                ok = APT_RE.match(frm) and APT_RE.match(to) and TIME_RE.match(std) and TIME_RE.match(sta)
                if not ok:
                    out["warnings"].append(f"leg_unreadable: row {row} {b['reg']} '{f}' {frm}-{to} {std}/{sta}"); continue
                h1, m1 = map(int, std.split(":")); h2, m2 = map(int, sta.split(":"))
                dep = dt.datetime.combine(dg["date"], dt.time(h1, m1))
                arr = dt.datetime.combine(dg["date"], dt.time(h2, m2))
                if arr <= dep: arr += dt.timedelta(days=1)
                flag, remark = s(cells[6]), s(cells[7])
                out["legs"].append({
                    "reg": b["reg"], "flight": f"{mm.group(1)}{mm.group(2)}", "flight_raw_suffix": "/F" if mm.group(3) else "",
                    "from": frm, "to": to, "std_utc": dep.strftime("%Y-%m-%d %H:%M"), "sta_utc": arr.strftime("%Y-%m-%d %H:%M"),
                    "code": s(cells[5]), "flags": flag.split() if flag else [], "remark": remark, "cell_row": row,
                    "ferry_probable": bool(mm.group(3)),
                })
    # per aircraft checks
    for b in blocks:
        legs = [l for l in out["legs"] if l["reg"] == b["reg"]]
        legs.sort(key=lambda l: (l["std_utc"], l["sta_utc"]))
        blk = sum(int((dt.datetime.fromisoformat(l["sta_utc"]) - dt.datetime.fromisoformat(l["std_utc"])).total_seconds() // 60) for l in legs)
        info = {"reg": b["reg"], "seats": b["seats"], "legs": len(legs), "block_min_computed": blk, "block_min_header": b["hdr_block_min"],
                "block_matches_header": blk == b["hdr_block_min"], "chain_breaks": [], "overlaps": [], "turnarounds": []}
        for a, n in zip(legs, legs[1:]):
            gap = int((dt.datetime.fromisoformat(n["std_utc"]) - dt.datetime.fromisoformat(a["sta_utc"])).total_seconds() // 60)
            if a["to"] != n["from"]: info["chain_breaks"].append({"after": a["flight"], "arrives": a["to"], "next": n["flight"], "departs": n["from"]})
            elif gap < 0: info["overlaps"].append({"after": a["flight"], "next": n["flight"], "gap_min": gap})
            else: info["turnarounds"].append({"station": a["to"], "arr_flight": a["flight"], "dep_flight": n["flight"], "sta_utc": a["sta_utc"], "std_utc": n["std_utc"], "ground_min": gap})
        out["aircraft"][b["reg"]] = info
    return out


if __name__ == "__main__":
    r = read(sys.argv[1])
    json.dump(r, open(sys.argv[2], "w"), ensure_ascii=False, indent=1) if len(sys.argv) > 2 else None
    print("layout", r["layout"], r["meta"], "legs", len(r["legs"]), "notes", len(r["notes"]))
    for w in r["warnings"]: print("WARN", w)
    for n in r["notes"]: print("NOTE", n)
    for reg, i in r["aircraft"].items():
        print(reg, "legs", i["legs"], "block", i["block_min_computed"], "vs hdr", i["block_min_header"], "OK" if i["block_matches_header"] else "DIFF", "breaks", len(i["chain_breaks"]), "overlaps", len(i["overlaps"]))
