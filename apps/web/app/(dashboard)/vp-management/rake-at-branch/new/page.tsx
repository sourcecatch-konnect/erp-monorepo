import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationForm from "@/features/rail-rake-operation/RailRakeOperationForm";

export default function NewRakeAtBranchPage() {
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_BRANCH.CREATE}>
      <RailRakeOperationForm mode="create" context="branch" />
    </ProtectedRoute>
  );
}
