"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@skerp/ui/components/button";
import {
    Card,
    CardContent,
} from "@skerp/ui/components/Card";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { BillingPageHeader } from "./components/billingPageHeader";
import { billingApi } from "./billing.service";
import { BillPreview } from "./billPreview";

export function BillDetailPage({
    billId,
}: {
    billId: string;
}) {
    const router = useRouter();

    const bill = useQuery({
        queryKey: ["billing", "bill", billId],
        queryFn: () => billingApi.bill(billId),
    });

    return (
        <div className="space-y-6">
            <BillingPageHeader
                title={bill.data?.billNumber ?? "Draft bill details"}
                description="Review the invoice on the left. For a draft, add or explain later charges in the amendment panel on the right."
                actions={
                    <Button
                        variant="outline"
                        onClick={() => router.push("/accounts/bills")}
                    >
                        Back to register
                    </Button>
                }
            />

            {bill.isLoading ? <Skeleton className="h-96" /> : null}

            {bill.isError ? (
                <Card>
                    <CardContent className="p-6 text-sm text-destructive">
                        {bill.error instanceof Error
                            ? bill.error.message
                            : "Could not load this bill"}
                    </CardContent>
                </Card>
            ) : null}

            {bill.data ? <BillPreview bill={bill.data} /> : null}
        </div>
    );
}