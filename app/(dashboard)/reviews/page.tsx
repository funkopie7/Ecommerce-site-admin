import { ReviewsView } from "@/components/admin/ReviewsView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <ReviewsView />;
}
