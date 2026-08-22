import { ProtectedRoute } from "@/features/auth";
import { MRRREditPage } from "@/features/mrrr/mrrrEditPage";

import { PERMS } from "@skerp/types";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.MRRR.UPDATE}>
      <MRRREditPage mrrrId={id} />
    </ProtectedRoute>
  );
}
