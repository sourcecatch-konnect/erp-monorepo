import { ProtectedRoute } from "@/features/auth";
import { OrderDetail } from "@/features/orders";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.ORDER.VIEW}>
      <OrderDetail orderId={id} />
    </ProtectedRoute>
  );
}
