"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { JobCardFormPage } from "@/features/job-card";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.JOBCARD_VIEW}>
      <JobCardFormPage jobCardId={params.id} />
    </ProtectedRoute>
  );
}
