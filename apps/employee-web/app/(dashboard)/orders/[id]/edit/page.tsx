import { ProtectedRoute } from "@/features/auth";
import { OrderEditPage } from "@/features/orders";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
    const { id } = await params;
    return (
        <ProtectedRoute permission={PERMS.ORDER.UPDATE}>
            <OrderEditPage orderId={id} />
        </ProtectedRoute>
    );
}