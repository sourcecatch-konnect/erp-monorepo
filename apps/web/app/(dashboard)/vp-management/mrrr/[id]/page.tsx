import MRRRDetail from "@/features/mrrr/mrrrDetail";


export default async function MRRRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MRRRDetail mrrrId={id} />;
}