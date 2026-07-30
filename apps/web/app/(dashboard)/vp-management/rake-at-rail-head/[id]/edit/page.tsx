import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationEdit from "@/features/rail-rake-operation/RailRakeOperationEdit";

export default async function EditRakeAtRailHeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_RAIL_HEAD.UPDATE}>
      <RailRakeOperationEdit id={decodeURIComponent(id)} context="railhead" />
    </ProtectedRoute>
  );
}
