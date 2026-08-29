import { CategoriesView } from "@/components/admin/CategoriesView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <CategoriesView />;
}
