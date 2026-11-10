import { cookies } from "next/headers";

/** Cookie that remembers the platform owner chose to look at the app as a company ("preview mode"). Only meaningful for the owner. */
export const MODE_COOKIE = "skyeye_view";

export async function inCompanyView(): Promise<boolean> {
  return (await cookies()).get(MODE_COOKIE)?.value === "company";
}
