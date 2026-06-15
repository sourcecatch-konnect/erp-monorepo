import { ProtectedRoute } from "@/features/auth";
import { LRForm } from "@/features/lorry-receipts";
import { PERMS } from "@skerp/types";

type Props = {
  searchParams: Promise<{ orderId?: string; tripId?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { orderId, tripId } = await searchParams;
  return (
    <ProtectedRoute permission={PERMS.LORRY_RECEIPT.CREATE}>
      <LRForm orderId={orderId} tripId={tripId} />
    </ProtectedRoute>
  );
}
