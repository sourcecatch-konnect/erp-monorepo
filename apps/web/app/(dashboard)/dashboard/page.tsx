"use client";

import { useAuth } from "@/features/auth";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-foreground">{user?.email}</span>.
        Modules will appear here as they are built.
      </p>
    </div>
  );
}
