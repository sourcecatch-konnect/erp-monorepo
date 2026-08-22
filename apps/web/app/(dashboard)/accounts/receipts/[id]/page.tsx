"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { ReceiptDetailPage } from "@/features/receivables";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.RECEIPT.VIEW}>
      <ReceiptDetailPage receiptId={params.id} />
    </ProtectedRoute>
  );
}
