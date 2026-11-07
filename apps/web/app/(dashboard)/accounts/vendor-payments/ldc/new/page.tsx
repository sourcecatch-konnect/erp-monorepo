import { ProtectedRoute } from "@/features/auth";
import { LDCPaymentPage } from "@/features/vendor-payment";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ACCOUNTS.PAYMENT.CREATE}>
      <LDCPaymentPage />
    </ProtectedRoute>
  );
}
