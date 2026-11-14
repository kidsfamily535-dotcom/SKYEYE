"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { MODE_COOKIE } from "@/lib/mode";

/** Owner only: open the company app (preview). The cookie is ignored for everyone else. */
export async function viewAsCompany() {
  if (!(await isPlatformAdmin())) redirect("/");
  (await cookies()).set(MODE_COOKIE, "company", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  redirect("/");
}

/** Leave preview mode and go back to the owner console. */
export async function backToOwner() {
  (await cookies()).delete(MODE_COOKIE);
  redirect("/admin");
}
