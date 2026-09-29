"use client";

import { useRouter } from "next/navigation";
import { Button } from "@skerp/ui/components/button";
import { PageHeader } from "./vendor-payment.ui";
import { VendorPaymentRegisterList } from "./VendorPaymentRegisterList";

export function VendorPaymentRegisterPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor payments"
        description="Slip → Approval → Disbursement for transporter and hamali (labour) payments."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => router.push("/accounts/vendor-payments/hamali/new")}
            >
              New hamali slip
            </Button>
            <Button onClick={() => router.push("/accounts/vendor-payments/new")}>
              New transporter slip
            </Button>
          </>
        }
      />
      <VendorPaymentRegisterList />
    </div>
  );
}
