import { ProtectedRoute } from "@/features/auth";
import EwaybillInbox from "@/features/ewaybill/EwaybillInbox";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.EWAYBILL.VIEW}>
      <EwaybillInbox />
    </ProtectedRoute>
  );
}
