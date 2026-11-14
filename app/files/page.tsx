import Link from "next/link";
import Shell from "@/components/Shell";
import FilesLibrary from "@/components/FilesLibrary";
import { getCommandData } from "@/lib/data";
import { getFilesData } from "@/lib/files";
import { getT } from "@/lib/lang";

export default async function FilesPage() {
  const { t } = await getT();
  const [d, f] = await Promise.all([getCommandData(), getFilesData()]);
  return (
    <Shell data={d}>
      <main className="page">
        <section className="fhero" aria-label={t("nav.files")}><Link href="/" className="btn ghost sm">{t("lib.backHome")}</Link><h1>{t("nav.files")}</h1><p>{t("files.sub")}</p></section>
        {!f && <p className="muted">{t("home.noMembership")}</p>}
        {f && !f.canWrite && <p role="status" className="muted">{t("files.viewOnly")}</p>}
        {f && <FilesLibrary companyId={f.companyId} canWrite={f.canWrite} active={f.active} drafts={f.drafts} />}
      </main>
    </Shell>
  );
}
