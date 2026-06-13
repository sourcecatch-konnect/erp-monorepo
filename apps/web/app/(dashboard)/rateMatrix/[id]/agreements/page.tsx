import RateMatrixCompanyAgreementsClient from "@/features/masters/rateMatrix/Agreements(Company)/agreement";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return <RateMatrixCompanyAgreementsClient rateMatrixId={id} />;
}
