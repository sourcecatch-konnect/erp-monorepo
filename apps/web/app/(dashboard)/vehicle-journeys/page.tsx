import { ProtectedRoute } from "@/features/auth";
import { VehicleJourneyListPage } from "@/features/vehicle-journeys";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.VEHICLE_JOURNEY.VIEW}>
      <VehicleJourneyListPage />
    </ProtectedRoute>
  );
}
