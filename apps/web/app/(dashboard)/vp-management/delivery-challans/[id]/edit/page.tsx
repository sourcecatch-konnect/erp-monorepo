import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import DeliveryChallanEdit from "@/features/delivery-challan/DeliveryChallanEdit";

export default async function EditDeliveryChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.DELIVERY_CHALLAN.UPDATE}>
      <DeliveryChallanEdit deliveryChallanId={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
