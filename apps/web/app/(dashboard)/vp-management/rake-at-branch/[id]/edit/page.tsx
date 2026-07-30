import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationEdit from "@/features/rail-rake-operation/RailRakeOperationEdit";

export default async function EditRakeAtBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_BRANCH.UPDATE}>
      <RailRakeOperationEdit id={decodeURIComponent(id)} context="branch" />
    </ProtectedRoute>
  );
}
