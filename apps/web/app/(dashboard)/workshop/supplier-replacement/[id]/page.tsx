"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { SupplierReplacementDetailPage } from "@/features/supplier-replacement";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.REPLACEMENT_VIEW}>
      <SupplierReplacementDetailPage replacementListId={params.id} />
    </ProtectedRoute>
  );
}
