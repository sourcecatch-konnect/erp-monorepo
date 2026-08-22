"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { BillDetailPage } from "@/features/billing";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.BILLING.VIEW}>
      <BillDetailPage billId={params.id} />
    </ProtectedRoute>
  );
}
