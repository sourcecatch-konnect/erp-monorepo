import { ProtectedRoute } from "@/features/auth";
import { TripForm } from "@/features/trips";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.TRIP.CREATE}>
      <TripForm mode="create" />
    </ProtectedRoute>
  );
}
