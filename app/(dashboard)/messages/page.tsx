import { MessagesView } from "@/components/admin/MessagesView";
import { requireAdminPage } from "@/lib/guard";

export default async function Page() {
  await requireAdminPage();
  return <MessagesView />;
}
