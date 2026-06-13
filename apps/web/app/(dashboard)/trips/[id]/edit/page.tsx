import { ProtectedRoute } from "@/features/auth";
import { TripEditPage } from "@/features/trips";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.TRIP.UPDATE}>
      <TripEditPage tripId={id} />
    </ProtectedRoute>
  );
}
