import { ProtectedRoute } from "@/features/auth";
import { VendorPaymentDisbursementQueuePage } from "@/features/vendor-payment";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ACCOUNTS.PAYMENT.DISBURSE}>
      <VendorPaymentDisbursementQueuePage />
    </ProtectedRoute>
  );
}
