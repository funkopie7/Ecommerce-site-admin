import { ProductsView } from "@/components/admin/ProductsView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <ProductsView />;
}
