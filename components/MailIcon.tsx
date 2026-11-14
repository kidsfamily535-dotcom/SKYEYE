/** Small category glyph for the mail list (purely decorative; the category name is always shown as text). */
const PATHS: Record<string, string> = {
  mvt: "M2 14l20-8-6 14-4-6z",
  load_message: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
  schedule: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  service_request: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  slot: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  permit: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  finance: "M3 7h18v12H3zM3 11h18M7 15h3",
  complaint: "M12 3l10 18H2zM12 10v5M12 18v.5",
  general: "M3 7l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
};

export default function MailIcon({ category, size = 26 }: { category: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[category] ?? PATHS.general} />
    </svg>
  );
}
