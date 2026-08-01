import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationList from "@/features/rail-rake-operation/RailRakeOperationList";

export default function RakeAtBranchPage() {
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_BRANCH.VIEW}>
      <RailRakeOperationList context="branch" />
    </ProtectedRoute>
  );
}
