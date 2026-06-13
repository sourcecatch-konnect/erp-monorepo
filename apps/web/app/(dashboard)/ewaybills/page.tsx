import { ProtectedRoute } from "@/features/auth";
import EwaybillDashboard from "@/features/ewaybill/EwaybillDashboard";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.EWAYBILL.VIEW}>
      <EwaybillDashboard />
    </ProtectedRoute>
  );
}
