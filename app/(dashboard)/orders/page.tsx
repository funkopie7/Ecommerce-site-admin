import { OrdersView } from "@/components/admin/OrdersView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <OrdersView />;
}
