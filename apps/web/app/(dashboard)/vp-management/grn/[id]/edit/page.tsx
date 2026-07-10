import { ProtectedRoute } from "@/features/auth";
import GRNEditPage from "@/features/grn/grnEditPage";


import { PERMS } from "@skerp/types";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.GRN.UPDATE}>
      <GRNEditPage params={{ id }} />
    </ProtectedRoute>
  );
}