import { CouponsView } from "@/components/admin/CouponsView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <CouponsView />;
}
