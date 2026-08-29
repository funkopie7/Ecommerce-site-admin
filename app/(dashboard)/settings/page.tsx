import { KeyRound, Store } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/lib/guard";

/**
 * Placeholder by design. There is no settings backend yet — no store-profile
 * model, no admin-account model — so this page states what exists today rather
 * than showing a form whose values would go nowhere.
 */
export default async function SettingsPage() {
  await requireAdminPage();

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Store and account settings are not managed here yet."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <KeyRound className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Admin access</CardTitle>
              <CardDescription>How you got in.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Access is a single shared admin key, checked at sign-in and held in a 12-hour
            httpOnly session cookie. There are no individual admin accounts, roles or
            permissions to configure yet.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Store className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Store profile</CardTitle>
              <CardDescription>Coming soon.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Shipping rates, tax, payment providers and storefront copy are all fixed in code
            today. When a settings model lands in the schema, this page is where it will be
            edited.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
