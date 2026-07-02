import { ProtectedRoute } from "@/features/auth";
import { MRRRForm } from "@/features/mrrr/mrrrForm";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ORDER.CREATE}>
      <MRRRForm mode="create" />
    </ProtectedRoute>
  );
}
