"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@skerp/ui/components/sidebar";
import { Separator } from "@skerp/ui/components/separator";
import { AppSidebar } from "./AppSidebar";
import { AppBreadcrumb } from "./AppBreadcrumb";
import { NotificationBellButton } from "@/features/notifications/NotificationBellButton";

/**
 * Authenticated app frame: collapsible sidebar + a top bar with the
 * sidebar trigger and a route breadcrumb. Used by the (dashboard) layout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <AppBreadcrumb />
          <div className="ml-auto">
            <NotificationBellButton />
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
