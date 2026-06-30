import { ProtectedRoute } from "@/features/auth";
import { VPScheduleForm } from "@/features/VP-Schedule/vp-scheduleForm";

import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ORDER.CREATE}>
      <VPScheduleForm mode="create" />
    </ProtectedRoute>
  );
}