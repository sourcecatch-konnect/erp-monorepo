import { ProtectedRoute } from "@/features/auth";
import GRNForm from "@/features/grn/grnForm";

import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.GRN.CREATE}>
      <GRNForm  />
    </ProtectedRoute>
  );
}
