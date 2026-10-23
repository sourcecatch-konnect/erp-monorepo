import { ProtectedRoute } from "@/features/auth";
import { VehiclePnlDetailPage } from "@/features/vehicle-journeys";
import { PERMS } from "@skerp/types";

export default async function Page({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  return (
    <ProtectedRoute permission={PERMS.LOGSLIP.VIEW}>
      <VehiclePnlDetailPage vehicleId={vehicleId} />
    </ProtectedRoute>
  );
}
