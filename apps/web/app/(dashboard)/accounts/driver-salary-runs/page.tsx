import { ProtectedRoute } from "@/features/auth";
import { SalaryRunsPage } from "@/features/driver-finance";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.DRIVER_FINANCE.SALARY_VIEW}>
      <SalaryRunsPage />
    </ProtectedRoute>
  );
}
