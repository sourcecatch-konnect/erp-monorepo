import { ProtectedRoute } from "@/features/auth";
import { VehiclePnlPage } from "@/features/vehicle-journeys";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LOGSLIP.VIEW}>
      <VehiclePnlPage />
    </ProtectedRoute>
  );
}
