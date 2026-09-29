"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { VendorPaymentDisbursePage } from "@/features/vendor-payment";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.ACCOUNTS.PAYMENT.DISBURSE}>
      <VendorPaymentDisbursePage id={params.id} />
    </ProtectedRoute>
  );
}
