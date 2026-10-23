"use client";

import { PageHeader } from "./vendor-payment.ui";
import { TransporterSlipWizard } from "./TransporterSlipWizard";

export function VendorPaymentSlipPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New transporter payment slip"
        description="Claim delivered market-vehicle LRs for a transporter, confirm freight/deduction amounts, and save a draft or submit for accrual."
      />
      <TransporterSlipWizard />
    </div>
  );
}
