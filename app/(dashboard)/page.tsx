import { DashboardView } from "@/components/admin/DashboardView";
import { requireAdminPage } from "@/lib/guard";

export default async function DashboardPage() {
  await requireAdminPage();
  return <DashboardView />;
}
