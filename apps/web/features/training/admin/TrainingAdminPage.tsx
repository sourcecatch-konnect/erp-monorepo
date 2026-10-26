"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import { RolesTab } from "./RolesTab";
import { TeamTab } from "./TeamTab";

// Radix sets data-state="active"; the shared Tabs' `data-active:` styles don't match it.
const TAB_CLASS =
  "px-3 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground";

/** A5 — Settings → Training. */
export function TrainingAdminPage() {
  const [tab, setTab] = useState("roles");

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Training</h1>
        <p className="text-sm text-muted-foreground">
          Describe each role, choose the training it must take, and see how
          your team is getting on.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="h-10">
          <TabsTrigger value="roles" className={TAB_CLASS}>
            Roles and their training
          </TabsTrigger>
          <TabsTrigger value="team" className={TAB_CLASS}>
            Team progress
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
