"use client";

import { PageHeader } from "./vendor-payment.ui";
import { LDCSlipWizard } from "./LDCSlipWizard";

export function LDCPaymentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New LDC broker payment slip"
        description="Pay the last-mile broker for issued delivery challans: freight plus slab detention, less advance and TDS. Save a draft or submit for accrual."
      />
      <LDCSlipWizard />
    </div>
  );
}
