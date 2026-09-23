"use client";

import { PageHeader } from "./vendor-payment.ui";
import { HamaliSlipWizard } from "./HamaliSlipWizard";

export function HamaliPaymentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New hamali payment slip"
        description="Combine origin GRN, Rail Branch GRN and VP Wagon Loading hamali for one labour, apply TDS, and save a draft or submit for accrual."
      />
      <HamaliSlipWizard />
    </div>
  );
}
