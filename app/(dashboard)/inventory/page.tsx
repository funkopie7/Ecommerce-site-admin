import { InventoryView } from "@/components/admin/InventoryView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <InventoryView />;
}
