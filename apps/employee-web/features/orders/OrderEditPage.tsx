"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import OrderForm from "./OrderForm";

export default function OrderEditPage({ orderId }: { orderId: string }) {
    const { data: order, isLoading } = useQuery({
        queryKey: orderKeys.detail(orderId),
        queryFn: () => orderApi.detail(orderId),
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
    });

    if (isLoading || !order) {
        return (
            <div className="mx-auto max-w-5xl space-y-3 p-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return <OrderForm mode="edit" order={order} />;
}