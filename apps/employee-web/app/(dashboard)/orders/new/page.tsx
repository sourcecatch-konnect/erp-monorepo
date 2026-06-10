import { ProtectedRoute } from "@/features/auth";
import { OrderCreatePage } from "@/features/orders";
import { PERMS } from "@skerp/types";

export default function Page() {
    return (
        <ProtectedRoute permission={PERMS.ORDER.CREATE}>
            <OrderCreatePage />
        </ProtectedRoute>
    );
}