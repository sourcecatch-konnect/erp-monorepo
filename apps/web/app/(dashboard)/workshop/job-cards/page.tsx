import { ProtectedRoute } from "@/features/auth";
import { JobCardListPage } from "@/features/job-card";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.JOBCARD_VIEW}>
      <JobCardListPage />
    </ProtectedRoute>
  );
}
