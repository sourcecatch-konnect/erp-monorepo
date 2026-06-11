import { ProtectedRoute } from "@/features/auth";
import { TripDetail } from "@/features/trips";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.TRIP.VIEW}>
      <TripDetail id={id} />
    </ProtectedRoute>
  );
}
