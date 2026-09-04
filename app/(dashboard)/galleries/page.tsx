import { GalleriesView } from "@/components/admin/GalleriesView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <GalleriesView />;
}
