import RateMatrixCompanyAgreementsPage from "@/features/masters/rateMatrix/Agreements(Company)";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return <RateMatrixCompanyAgreementsPage rateMatrixId={id} />;
}