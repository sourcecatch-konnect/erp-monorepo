"use client";

import { useAuth } from "@/features/auth";
import { TrainingDashboardPanel, TrainingWelcome } from "@/features/training";

export default function DashboardPage() {
  const { user } = useAuth();
  import { Suspense } from "react";
  import { DashboardLoading, DashboardPage } from "@/features/dashboard";

  // DashboardPage keeps period and branch in the URL (?period=&branch=) with
  // useSearchParams, which needs a Suspense boundary during prerender. The
  // fallback is the real grid's skeleton, so the page never flashes blank.
  export default function Page() {
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
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPage />
    </Suspense>
    );
  }
