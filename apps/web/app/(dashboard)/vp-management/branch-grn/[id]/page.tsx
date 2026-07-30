import RailBranchGRNDetail from "@/features/rail-branch-grn/RailBranchGRNDetail";

export default async function RailBranchGRNDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RailBranchGRNDetail id={id} />;
}
