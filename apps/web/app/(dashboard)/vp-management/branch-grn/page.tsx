import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailBranchGRNList from "@/features/rail-branch-grn/RailBranchGRNList";

export default function RailBranchGRNPage() {
  return (
    <ProtectedRoute permission={PERMS.RAIL_BRANCH_GRN.VIEW}>
      <RailBranchGRNList />
    </ProtectedRoute>
  );
}
