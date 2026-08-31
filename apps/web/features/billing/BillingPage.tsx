"use client";

import * as React from "react";
import { useRouter } from "next/navigation";


import { Button } from "@skerp/ui/components/button";


import { BillingPageHeader } from "./components/billingPageHeader";

import { LRToBillWorkbench } from "./components/lrtoBillWorkBench";





export function LRToBillPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <BillingPageHeader
        title="LR to Bill"
        description="Select the client, combine eligible LRs, enter common charges and review GST on one page."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/accounts/bills")}
          >
            Open billing register
          </Button>
        }
      />
      <LRToBillWorkbench />
    </div>
  );
}


export default LRToBillPage;