import GRNDetailPage from "@/features/grn/GRNDetail";


type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return <GRNDetailPage id={id} />;
}