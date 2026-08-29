"use client";

import * as React from "react";

import { AppSidebar } from "@/components/admin/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

/**
 * The authenticated admin frame: persistent collapsible sidebar plus a sticky
 * strip carrying the collapse trigger. Rendered once from
 * app/(dashboard)/layout.tsx, so every admin route inherits it.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Funkopie / Admin
          </span>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
