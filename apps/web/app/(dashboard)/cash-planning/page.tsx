import { ProtectedRoute } from "@/features/auth";
import { CashPlanningPage } from "@/features/cash-planning";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.CASH_PLANNING.VIEW}>
      <CashPlanningPage />
    </ProtectedRoute>
  );
}
