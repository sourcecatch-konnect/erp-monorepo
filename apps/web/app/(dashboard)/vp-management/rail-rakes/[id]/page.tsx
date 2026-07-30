import RailRakeDetail from "@/features/rail-rake/RailRakeDetail";

export default async function RailRakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RailRakeDetail rakeId={id} />;
}
