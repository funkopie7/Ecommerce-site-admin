import { TagsView } from "@/components/admin/TagsView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <TagsView />;
}
