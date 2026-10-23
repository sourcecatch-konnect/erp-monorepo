"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { SpareInwardDetailPage } from "@/features/spare-inward";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.INWARD_VIEW}>
      <SpareInwardDetailPage inwardId={params.id} />
    </ProtectedRoute>
  );
}
