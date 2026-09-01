"use client";

import { useRouter } from "next/navigation";

import { Button } from "@skerp/ui/components/button";
import { BillingPageHeader } from "./components/billingPageHeader";
import { TaxRules } from "./taxRule";

export function BillingSettingsPage() {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <BillingPageHeader
                title="Billing GST rules"
                description="Maintain effective-dated GST calculation rules separately from daily LR billing work."
                actions={
                    <Button
                        variant="outline"
                        onClick={() => router.push("/accounts/bills")}
                    >
                        Back to register
                    </Button>
                }
            />

            <TaxRules />
        </div>
    );
}