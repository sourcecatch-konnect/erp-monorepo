import EwaybillDetail from "@/features/ewaybill/EwaybillDetail";

type Params = Promise<{ ewbNo: string }>;

export default async function Page({ params }: { params: Params }) {
  const { ewbNo } = await params;
  return <EwaybillDetail ewbNo={ewbNo} />;
}
