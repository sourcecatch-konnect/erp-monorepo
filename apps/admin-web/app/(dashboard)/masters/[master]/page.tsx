import { notFound } from "next/navigation";
import { masterRegistry } from "@/features/masters/registry";

type Props = {
  params: Promise<{
    master: string;
  }>;
};

export default async function MasterPage({ params }: Props) {
  const { master } = await params;
  const entry = masterRegistry.find((item) => item.slug === master);

  if (!entry) {
    notFound();
  }

  const { default: Page } = await entry.page();

  return <Page />;
}
