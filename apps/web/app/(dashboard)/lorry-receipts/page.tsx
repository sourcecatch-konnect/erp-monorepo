import { Suspense } from "react";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { ProtectedRoute } from "@/features/auth";
import { LRListPage } from "@/features/lorry-receipts";
import { PERMS } from "@skerp/types";

// Suspense boundary so the table skeleton shows during prerender.
function Loading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LORRY_RECEIPT.VIEW}>
      <Suspense fallback={<Loading />}>
        <LRListPage />
      </Suspense>
    </ProtectedRoute>
  );
}
