import { Suspense } from "react";
import { MyWorkPage } from "@/features/my-work";

// MyWorkPage keeps its filters in the URL (?area=&step=&show=) with
// useSearchParams, which needs a Suspense boundary during prerender.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyWorkPage />
    </Suspense>
  );
}
