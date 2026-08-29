import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSessionValid } from "@/lib/auth";

/**
 * Server-side gate for every admin page. Reads the httpOnly `admin_session`
 * cookie set by /api/auth/admin-login and verifies the JWT before any page
 * content is rendered or streamed. Called from the (dashboard) layout and again
 * from each page in it, so a route can never end up unguarded by being added
 * without its own check.
 */
export async function requireAdminPage() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!token || !(await adminSessionValid(token))) redirect("/admin/login");
}
