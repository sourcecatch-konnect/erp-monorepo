import { ProtectedRoute } from "@/features/auth";
import { OrderDetailPage } from "@/features/orders";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
    const { id } = await params;
    return (
        <ProtectedRoute permission={PERMS.ORDER.VIEW}>
            <OrderDetailPage orderId={id} />
        </ProtectedRoute>
    );
}