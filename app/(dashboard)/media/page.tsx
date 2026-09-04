import { MediaView } from "@/components/admin/MediaView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <MediaView />;
}
