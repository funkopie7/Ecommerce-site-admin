import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSessionValid } from "@/lib/auth";

export async function requireAdminPage() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!token || !(await adminSessionValid(token))) redirect("/admin/login");
}
