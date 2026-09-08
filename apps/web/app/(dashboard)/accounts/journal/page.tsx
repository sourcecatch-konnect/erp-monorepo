import { ProtectedRoute } from "@/features/auth";
import { ManualJournalPage } from "@/features/ledger";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LEDGER.JOURNAL_CREATE}>
      <ManualJournalPage />
    </ProtectedRoute>
  );
}
