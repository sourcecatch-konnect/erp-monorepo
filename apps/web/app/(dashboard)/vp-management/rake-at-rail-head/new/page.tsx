import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationForm from "@/features/rail-rake-operation/RailRakeOperationForm";

export default function NewRakeAtRailHeadPage() {
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_RAIL_HEAD.CREATE}>
      <RailRakeOperationForm mode="create" context="railhead" />
    </ProtectedRoute>
  );
}
