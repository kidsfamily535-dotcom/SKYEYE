/** Company or airline logo wherever the name appears; falls back to a badge until a logo is uploaded. */
export default function Logo({ url, code, name, size = "sm" }: { url?: string | null; code: string; name?: string | null; size?: "sm" | "md" }) {
  if (url) return <img className={`logo-img ${size}`} src={url} alt={name ?? code} />;
  return <b className={`logo ${size === "sm" ? "sm" : ""} ltr`} title={name ?? code}>{code}</b>;
}
