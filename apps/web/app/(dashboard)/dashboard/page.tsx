import { Suspense } from "react";
import { DashboardLoading, DashboardPage } from "@/features/dashboard";

// DashboardPage keeps period and branch in the URL (?period=&branch=) with
// useSearchParams, which needs a Suspense boundary during prerender. The
// fallback is the real grid's skeleton, so the page never flashes blank.
export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPage />
    </Suspense>
  );
}
