import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/guard";

/**
 * Route group for the authenticated admin. The parentheses keep it out of the
 * URL, so `app/(dashboard)/page.tsx` is still `/` and `products/page.tsx` is
 * still `/products` — the group exists only to hang the auth guard and the
 * sidebar shell on every admin route at once.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
