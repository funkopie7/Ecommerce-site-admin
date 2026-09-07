import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/guard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
