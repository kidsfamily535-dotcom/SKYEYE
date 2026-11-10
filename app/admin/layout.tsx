import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";

/** Every /admin page is owner-only. The database functions behind it refuse anyone else too; this is the second lock. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdmin())) notFound();
  return <>{children}</>;
}
