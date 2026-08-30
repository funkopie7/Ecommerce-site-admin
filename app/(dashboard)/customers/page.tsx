import { CustomersView } from "@/components/admin/CustomersView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <CustomersView />;
}
