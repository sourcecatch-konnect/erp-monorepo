import { ProtectedRoute } from "@/features/auth";
import { TrainingAdminPage } from "@/features/training";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ADMIN.TRAINING_MANAGE}>
      <TrainingAdminPage />
    </ProtectedRoute>
  );
}
