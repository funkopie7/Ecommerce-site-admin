import { CollectionsView } from "@/components/admin/CollectionsView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <CollectionsView />;
}
