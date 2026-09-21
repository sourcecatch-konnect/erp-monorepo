import { ProtectedRoute } from "@/features/auth";
import { JobCardFormPage } from "@/features/job-card";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.JOBCARD_MANAGE}>
      <JobCardFormPage />
    </ProtectedRoute>
  );
}
