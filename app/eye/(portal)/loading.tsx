import { eyeT } from "@/lib/eye/i18n-server";

// Shown while a page of the portal loads: three quiet placeholder rows.
export default async function EyeLoading() {
  const { t } = await eyeT();
  return (
    <div className="eye-page" role="status" aria-label={t("loading")}>
      <div className="eye-skel head" /><div className="eye-skel" /><div className="eye-skel" /><div className="eye-skel" />
    </div>
  );
}
