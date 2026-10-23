import { ProtectedRoute } from "@/features/auth";
import { OpeningBalancesPage } from "@/features/ledger/OpeningBalancesPage";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LEDGER.VIEW}>
      <OpeningBalancesPage />
    </ProtectedRoute>
  );
}
