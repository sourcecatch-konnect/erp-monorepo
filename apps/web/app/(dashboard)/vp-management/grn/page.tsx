
import { ProtectedRoute } from "@/features/auth";
import GrnListPage from "@/features/grn/grnListPage";


import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.GRN.VIEW}>
      <GrnListPage />
    </ProtectedRoute>
  );
}