import { Suspense } from "react";
import { ProtectedRoute } from "@/features/auth";
import { LedgerPage } from "@/features/ledger";
import { PERMS } from "@skerp/types";

// LedgerPage reads ?tab=&party= (deep links) with useSearchParams, which needs
// a Suspense boundary during prerender.
export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LEDGER.VIEW}>
      <Suspense fallback={null}>
        <LedgerPage />
      </Suspense>
    </ProtectedRoute>
  );
}
