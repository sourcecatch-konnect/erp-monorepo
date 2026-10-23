"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { VendorPaymentSlipDetailPage } from "@/features/vendor-payment";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.ACCOUNTS.PAYMENT.VIEW}>
      <VendorPaymentSlipDetailPage id={params.id} />
    </ProtectedRoute>
  );
}
