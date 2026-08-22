import { ProtectedRoute } from "@/features/auth";
import { LRToBillPage } from "@/features/billing";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.BILLING.VIEW}>
      <LRToBillPage />
    </ProtectedRoute>
  );
}
