"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { PurchaseOrderDetailPage } from "@/features/purchase-order";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.PO_VIEW}>
      <PurchaseOrderDetailPage purchaseOrderId={params.id} />
    </ProtectedRoute>
  );
}
