import { PERMS } from "@skerp/types";
import { ProtectedRoute } from "@/features/auth";
import { JobCardReconciliationPage } from "@/features/job-card/JobCardReconciliationPage";
export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.JOBCARD_VIEW}>
      <ProtectedRoute permission={PERMS.WORKSHOP.SERVICEBILL_VIEW}>
        <ProtectedRoute permission={PERMS.LEDGER.VIEW}>
          <JobCardReconciliationPage />
        </ProtectedRoute>
      </ProtectedRoute>
    </ProtectedRoute>
  );
}
