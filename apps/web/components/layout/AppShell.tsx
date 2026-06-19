"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@skerp/ui/components/sidebar";
import { Separator } from "@skerp/ui/components/separator";
import { AppSidebar } from "./AppSidebar";
import { AppBreadcrumb } from "./AppBreadcrumb";
import { BreadcrumbLabelsProvider } from "./breadcrumb-labels";
import { NotificationBellButton } from "@/features/notifications/NotificationBellButton";

/**
 * Authenticated app frame: collapsible sidebar + a top bar with the
 * sidebar trigger and a route breadcrumb. Used by the (dashboard) layout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <BreadcrumbLabelsProvider>
        <AppSidebar />

        <SidebarInset className="min-w-0 overflow-x-hidden">
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

          {/* Fixed-height internal scroll region: keeps the topbar in place and
              lets pages pin their own sticky footers/headers reliably. */}
          <main className="h-[calc(100svh-3.5rem)] min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="min-w-0 w-full max-w-full overflow-x-hidden p-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </BreadcrumbLabelsProvider>
    </SidebarProvider>
  );
}
