"use client";

import { useRouter } from "next/navigation";
import { Button } from "@skerp/ui/components/button";
import { ReceiptWizard } from "./ReceiptWizard";
import { PageHeader } from "./receipt.ui";

export function ReceiptCreatePage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Record a client payment"
        description="Pick the client, select the bills being settled, and enter received/TDS/damage/rate-difference amounts."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/accounts/receipts")}
          >
            Back to register
          </Button>
        }
      />
      <ReceiptWizard />
    </div>
  );
}
