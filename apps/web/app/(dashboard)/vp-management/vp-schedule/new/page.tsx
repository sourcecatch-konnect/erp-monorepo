import { ProtectedRoute } from "@/features/auth";
import { VPScheduleForm } from "@/features/VP-Schedule/vp-scheduleForm";

import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.VP_SCHEDULE.CREATE}>
      <VPScheduleForm mode="create" />
    </ProtectedRoute>
  );
}
