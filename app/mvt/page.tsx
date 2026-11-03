import Shell from "@/components/Shell";
import MvtReview from "@/components/MvtReview";
import { getCommandData } from "@/lib/data";
import { getPendingMvt } from "@/lib/mvt";
import { getT } from "@/lib/lang";

export default async function MvtPage() {
  const { t } = await getT();
  const [d, items] = await Promise.all([getCommandData(), getPendingMvt()]);
  return (
    <Shell data={d}>
      <h1>{t("mvt.title")}</h1>
      <p>{t("mvt.sub")}</p>
      {items.length === 0 ? <p>{t("mvt.empty")}</p> : items.map((i) => <MvtReview key={i.id} item={i} />)}
    </Shell>
  );
}
