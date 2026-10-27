import { TrackPage } from "@/features/training";

type Props = { params: Promise<{ trackKey: string }> };

export default async function Page({ params }: Props) {
  const { trackKey } = await params;
  return <TrackPage trackKey={trackKey} />;
}
