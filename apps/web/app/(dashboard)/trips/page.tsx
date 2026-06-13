import { ProtectedRoute } from "@/features/auth";
import { TripsListPage } from "@/features/trips";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.TRIP.VIEW}>
      <TripsListPage />
    </ProtectedRoute>
  );
}
