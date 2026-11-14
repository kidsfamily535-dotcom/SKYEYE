/** Decorative glyph for a priority row. The tone is always also written as text next to it. */
const PATHS: Record<string, string> = {
  late: "M12 3l10 18H2zM12 10v5M12 18v.5",
  warn: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  info: "M3 7l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  ok: "M20 6L9 17l-5-5",
  inbox: "M3 7l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  flights: "M2 14l20-8-6 14-4-6z",
  shift: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  files: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  agent: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3zM17 19a3 3 0 0 1-3 2h-2",
};

export default function ToneIcon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}
