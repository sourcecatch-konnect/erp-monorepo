import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarSeparator,
} from "./sidebar";

import { Button } from "./button";

const meta: Meta<typeof Sidebar> = {
  title: "Components/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

/* ---------------- Basic Sidebar ---------------- */
export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <h2 className="text-sm font-semibold">My App</h2>
          </SidebarHeader>

          <SidebarSeparator />

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>

              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Dashboard</SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton>Projects</SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton>Settings</SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <Button variant="ghost" size="sm">
              Logout
            </Button>
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <div className="flex-1 p-4">
          <SidebarTrigger />
          <div className="mt-4 text-sm">
            Main content area (click trigger to collapse sidebar)
          </div>
        </div>
      </div>
    </SidebarProvider>
  ),
};

/* ---------------- Collapsed View ---------------- */
export const Collapsed: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <div className="flex w-full min-h-screen">
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Home</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>Analytics</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 p-4">
          <SidebarTrigger />
          <p className="mt-4 text-sm">Collapsed sidebar state</p>
        </div>
      </div>
    </SidebarProvider>
  ),
};

/* ---------------- Grouped Menu Example ---------------- */
export const WithGroups: Story = {
  render: () => (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>General</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Home</SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Profile</SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Users</SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Settings</SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 p-4">
          <SidebarTrigger />
        </div>
      </div>
    </SidebarProvider>
  ),
};