"use client";

import { useAuth } from "@/features/auth";
import { TrainingDashboardPanel, TrainingWelcome } from "@/features/training";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          Welcome back{user ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{user?.email}</span>.
        </p>
      </div>
      <TrainingDashboardPanel />
      <TrainingWelcome />
    </div>
  );
}
