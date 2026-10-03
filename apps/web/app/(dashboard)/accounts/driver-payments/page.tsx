import { ProtectedRoute } from "@/features/auth";
import { DriverPaymentsPage } from "@/features/driver-finance";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.DRIVER_FINANCE.SALARY_VIEW}>
      <DriverPaymentsPage />
    </ProtectedRoute>
  );
}
