
import { ProtectedRoute } from "@/features/auth";
import GrnListPage from "@/features/grn/grnListpage";


import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.GRN.VIEW}>
      <GrnListPage />
    </ProtectedRoute>
  );
}