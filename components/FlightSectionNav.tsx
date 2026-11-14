import type { TFn } from "@/lib/i18n";

/** Jump links to the sections of the flight file, in the order they appear on the page. Plain anchors: no client JS. */
export default function FlightSectionNav({ t, items }: { t: TFn; items: { id: string; label: string; href?: string }[] }) {
  return (
    <nav className="tabs views fnav" aria-label={t("fl.views.aria")}>
      {items.map((x) => <a key={x.id} href={x.href ?? `#${x.id}`}>{x.label}</a>)}
    </nav>
  );
}
