import { ProtectedRoute } from "@/features/auth";
import { DayBookPage } from "@/features/ledger";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LEDGER.VOUCHER_VIEW}>
      <DayBookPage />
    </ProtectedRoute>
  );
}
