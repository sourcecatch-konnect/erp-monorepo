import { PERMS } from "@skerp/types";
import { ProtectedRoute } from "@/features/auth";
import { JobCardAuditPage } from "@/features/job-card/JobCardAuditPage";
export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.JOBCARD_VIEW}>
      <ProtectedRoute permission={PERMS.WORKSHOP.SERVICEBILL_VIEW}>
        <ProtectedRoute permission={PERMS.LEDGER.VIEW}>
          <ProtectedRoute permission={PERMS.ACCOUNTS.PAYMENT.VIEW}>
            <JobCardAuditPage />
          </ProtectedRoute>
        </ProtectedRoute>
      </ProtectedRoute>
    </ProtectedRoute>
  );
}
