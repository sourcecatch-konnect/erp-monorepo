import { ProtectedRoute } from "@/features/auth";
import { TrackingPage } from "@/features/tracking";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.TRACKING.VIEW}>
      <TrackingPage />
    </ProtectedRoute>
  );
}
