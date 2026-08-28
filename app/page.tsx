import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminWorkspace from "@/components/AdminWorkspace";
import { adminSessionValid } from "@/lib/auth";
export default async function AdminHome() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!token || !(await adminSessionValid(token))) redirect("/admin/login");
  return <AdminWorkspace />;
}
