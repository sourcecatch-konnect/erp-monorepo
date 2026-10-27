"use client";

import { useRouter } from "next/navigation";

import { Button } from "@skerp/ui/components/button";
import { PageHelp } from "@/features/training";
import { BillingPageHeader } from "./components/billingPageHeader";
import { BillsList } from "./billList";
import { BILLING_REGISTER_HELP } from "./help";

export function BillingRegisterPage() {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <BillingPageHeader
                title="Billing register"
                description="Open a bill to review its invoice, edit draft charges, or continue approval and finalisation."
                actions={
                    <>
                        <PageHelp content={BILLING_REGISTER_HELP} />
                        <Button
                            variant="outline"
                            onClick={() => router.push("/accounts/billing-settings")}
                        >
                            GST rules
                        </Button>

                        <Button onClick={() => router.push("/accounts/lr-to-bill")}>
                            Create from LR
                        </Button>
                    </>
                }
            />

            <BillsList />
        </div>
    );
}