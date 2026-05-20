"use client";

import Link from "next/link";
import { IconTruck } from "@tabler/icons-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@skerp/ui/components/sidebar";
import { ROUTES } from "@/config/routes";

/**
 * Sidebar header / brand block.
 *
 * To use a real logo, replace the icon box below with:
 *   <Image src="/logo.svg" alt="SK Translines" width={32} height={32} />
 * (drop the file in `public/`).
 */
export function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link href={ROUTES.dashboard}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <IconTruck className="size-5" />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-semibold">
                SK Translines
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Logistics ERP
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
