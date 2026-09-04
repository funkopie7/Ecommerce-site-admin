import { SettingsView } from "@/components/admin/SettingsView";
import { requireAdminPage } from "@/lib/guard";

export default async function SettingsPage() {
  await requireAdminPage();
  return <SettingsView />;
}
