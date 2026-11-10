"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { ClaimDetailPage } from "@/features/claims";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.CLAIM.VIEW}>
      <ClaimDetailPage claimId={params.id} />
    </ProtectedRoute>
  );
}
