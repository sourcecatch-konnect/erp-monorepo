import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import DeliveryChallanDetail from "@/features/delivery-challan/DeliveryChallanDetail";

export default async function DeliveryChallanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.DELIVERY_CHALLAN.VIEW}>
      <DeliveryChallanDetail deliveryChallanId={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
