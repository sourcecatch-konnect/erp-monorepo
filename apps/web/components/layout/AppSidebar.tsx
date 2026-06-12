"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@skerp/ui/components/sidebar";
import { SidebarBrand } from "./SidebarBrand";
import { NavMain } from "./NavMain";
import { NavUser } from "./NavUser";

/** The admin app sidebar: brand header, grouped nav, user footer. */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
