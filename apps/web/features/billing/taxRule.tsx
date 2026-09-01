"use client";

import * as React from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@skerp/ui/components/Card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import { formatLabel, today } from "./billing.util";
import { Field } from "./components/Field";
import { billingApi, BillType } from "./billing.service";
export
    function TaxRules() {
    const canManage = useCan(PERMS.BILLING.TAX_RULE_MANAGE);
    const queryClient = useQueryClient();
    const rules = useQuery({
        queryKey: ["billing", "tax-rules"],
        queryFn: billingApi.taxRules,
    });
    const [billType, setBillType] = React.useState<BillType>("ROAD_RAIL");
    const [effectiveFrom, setEffectiveFrom] = React.useState(today());
    const [cgst, setCgst] = React.useState("2.5");
    const [sgst, setSgst] = React.useState("2.5");
    const [igst, setIgst] = React.useState("5");
    const create = useMutation({
        mutationFn: () =>
            billingApi.createTaxRule({
                name: `${billType} GST`,
                billType,
                chargeMechanism: "FORWARD_CHARGE",
                sacCode: "9965",
                effectiveFrom,
                effectiveTo: null,
                cgstRateBps: Math.round(Number(cgst) * 100),
                sgstRateBps: Math.round(Number(sgst) * 100),
                igstRateBps: Math.round(Number(igst) * 100),
                isActive: true,
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["billing", "tax-rules"],
            });
            toast.success("GST rule created");
        },
        onError: (error) =>
            toast.error(
                error instanceof Error ? error.message : "Could not create GST rule",
            ),
    });
    return (
        <div className="space-y-5">
            {canManage ? (
                <Card className="overflow-hidden">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle>Create effective GST rule</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Rates are effective-dated. Finalised invoices retain their
                            original tax snapshot.
                        </p>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                        <Field label="Bill type">
                            <Select
                                value={billType}
                                onValueChange={(value) => setBillType(value as BillType)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ROAD_RAIL">Road + Rail</SelectItem>
                                    <SelectItem value="ROAD_GTA">Road GTA</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Effective from">
                            <Input
                                type="date"
                                value={effectiveFrom}
                                onChange={(event) => setEffectiveFrom(event.target.value)}
                            />
                        </Field>
                        <Field label="CGST %">
                            <Input
                                value={cgst}
                                onChange={(event) => setCgst(event.target.value)}
                            />
                        </Field>
                        <Field label="SGST %">
                            <Input
                                value={sgst}
                                onChange={(event) => setSgst(event.target.value)}
                            />
                        </Field>
                        <Field label="IGST %">
                            <Input
                                value={igst}
                                onChange={(event) => setIgst(event.target.value)}
                            />
                        </Field>
                        <div className="flex items-end">
                            <Button
                                onClick={() => create.mutate()}
                                disabled={create.isPending}
                            >
                                Create rule
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}
            <Card>
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Configured tax rules</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        The ERP selects the latest active rule for the bill type and invoice
                        date.
                    </p>
                </CardHeader>
                <CardContent>
                    {rules.isLoading ? (
                        <Skeleton className="h-32" />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Effective</TableHead>
                                    <TableHead>CGST / SGST / IGST</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.data?.map((rule) => (
                                    <TableRow key={String(rule.id)}>
                                        <TableCell>{String(rule.name)}</TableCell>
                                        <TableCell>{formatLabel(String(rule.billType))}</TableCell>
                                        <TableCell>
                                            {new Date(String(rule.effectiveFrom)).toLocaleDateString(
                                                "en-IN",
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {Number(rule.cgstRateBps) / 100}% /{" "}
                                            {Number(rule.sgstRateBps) / 100}% /{" "}
                                            {Number(rule.igstRateBps) / 100}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
