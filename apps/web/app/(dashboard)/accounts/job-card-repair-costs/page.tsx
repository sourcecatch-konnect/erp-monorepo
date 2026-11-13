import { PERMS } from "@skerp/types";
import { ProtectedRoute } from "@/features/auth";
import { JobCardRepairCostPage } from "@/features/job-card/JobCardRepairCostPage";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.JOBCARD_VIEW}>
      <JobCardRepairCostPage />
    </ProtectedRoute>
  );
}
