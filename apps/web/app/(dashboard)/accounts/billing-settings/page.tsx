import { ProtectedRoute } from "@/features/auth";
import { BillingSettingsPage } from "@/features/billing";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.BILLING.VIEW}>
      <BillingSettingsPage />
    </ProtectedRoute>
  );
}
