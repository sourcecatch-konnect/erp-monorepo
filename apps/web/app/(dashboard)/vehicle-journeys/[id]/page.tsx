import { ProtectedRoute } from "@/features/auth";
import { VehicleJourneyDetail } from "@/features/vehicle-journeys";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.VEHICLE_JOURNEY.VIEW}>
      <VehicleJourneyDetail id={id} />
    </ProtectedRoute>
  );
}
