import { ProtectedRoute } from "@/features/auth";
import { ReceiptRegisterPage } from "@/features/receivables";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.RECEIPT.VIEW}>
      <ReceiptRegisterPage />
    </ProtectedRoute>
  );
}
