import { ProtectedRoute } from "@/features/auth";
import { TrainingHomePage } from "@/features/training";

export default function Page() {
  return (
    <ProtectedRoute>
      <TrainingHomePage />
    </ProtectedRoute>
  );
}
