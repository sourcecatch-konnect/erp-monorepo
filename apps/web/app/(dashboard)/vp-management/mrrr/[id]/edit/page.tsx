import { ProtectedRoute } from "@/features/auth";
import { MRRRForm } from "@/features/mrrr/mrrrForm";
import { PERMS } from "@skerp/types";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.MRRR.UPDATE}>
      <MRRRForm mode="edit" mrrrId={id} />
    </ProtectedRoute>
  );
}
