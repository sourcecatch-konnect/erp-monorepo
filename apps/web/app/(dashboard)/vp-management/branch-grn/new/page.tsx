import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailBranchGRNForm from "@/features/rail-branch-grn/RailBranchGRNForm";

export default function RailBranchGRNCreatePage() {
  return (
    <ProtectedRoute permission={PERMS.RAIL_BRANCH_GRN.CREATE}>
      <RailBranchGRNForm mode="create" />
    </ProtectedRoute>
  );
}
