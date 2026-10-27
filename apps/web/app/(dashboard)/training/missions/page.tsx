import { notFound } from "next/navigation";
import { IS_TRAINING_ENVIRONMENT, MissionsPage } from "@/features/training";

// Practice missions use the demo data, which only exists on the training copy.
export default function Page() {
  if (!IS_TRAINING_ENVIRONMENT) notFound();
  return <MissionsPage />;
}
