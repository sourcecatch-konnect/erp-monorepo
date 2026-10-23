import { ProtectedRoute } from "@/features/auth";
import { ChartOfAccountsPage } from "@/features/ledger";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LEDGER.VIEW}>
      <ChartOfAccountsPage />
    </ProtectedRoute>
  );
}
