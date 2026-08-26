import { ProtectedRoute } from "@/features/auth";
import { LedgerPage } from "@/features/ledger";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LEDGER.VIEW}>
      <LedgerPage />
    </ProtectedRoute>
  );
}
