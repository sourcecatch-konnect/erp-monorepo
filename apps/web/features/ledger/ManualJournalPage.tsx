"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@skerp/ui/components/select";

import { branchApi } from "@/features/masters/branch/branch.service";
import { VoucherDialog } from "./components/VoucherDialog";
import { LedgerAccountPicker } from "./components/LedgerAccountPicker";
import { ledgerApi } from "./api/ledger.service";
import { money } from "./voucher.util";

type LineDraft = {
    key: string;
    ledgerId: string;
    side: "DEBIT" | "CREDIT";
    amount: string; // rupees, as typed
    narration: string;
};

const newLine = (): LineDraft => ({
    key: Math.random().toString(36).slice(2),
    ledgerId: "",
    side: "DEBIT",
    amount: "",
    narration: "",
});

const rupeesToPaise = (rupees: string): bigint => {
    const trimmed = rupees.trim();
    if (!trimmed) return 0n;
    const [whole, frac = ""] = trimmed.split(".");
    const paise = `${whole}${(frac + "00").slice(0, 2)}`;
    return BigInt(paise || "0");
};

const today = () => new Date().toISOString().slice(0, 10);

/** Free-form Manual Journal — the escape hatch for anything the specialised
 *  flows (Bill finalise, Receipt post) don't cover: opening balances,
 *  write-offs, inter-branch transfers, corrections. Posts through the same
 *  postJournal used everywhere else, so it's just as balance-checked. */
export function ManualJournalPage() {
    const [branchId, setBranchId] = React.useState("");
    const [voucherDate, setVoucherDate] = React.useState(today());
    const [narration, setNarration] = React.useState("");
    const [lines, setLines] = React.useState<LineDraft[]>([newLine(), newLine()]);
    const [voucherOpen, setVoucherOpen] = React.useState(false);
    const [postedVoucherId, setPostedVoucherId] = React.useState<string | null>(null);

    const branches = useQuery({
        queryKey: ["ledger", "journal", "branches"],
        queryFn: () => branchApi.list({ page: 0, size: 200 }),
    });

    const voucher = useQuery({
        queryKey: ["ledger", "voucher", postedVoucherId],
        queryFn: () => ledgerApi.voucher(postedVoucherId!),
        enabled: voucherOpen && Boolean(postedVoucherId),
    });

    const totals = React.useMemo(() => {
        let debit = 0n;
        let credit = 0n;
        for (const line of lines) {
            const amount = rupeesToPaise(line.amount);
            if (line.side === "DEBIT") debit += amount;
            else credit += amount;
        }
        return { debit, credit, balanced: debit === credit && debit > 0n };
    }, [lines]);

    const validLines = lines.filter(
        (l) => l.ledgerId && rupeesToPaise(l.amount) > 0n,
    );
    const canSubmit =
        Boolean(branchId) &&
        Boolean(voucherDate) &&
        validLines.length >= 2 &&
        validLines.length === lines.length &&
        totals.balanced;

    const create = useMutation({
        mutationFn: () =>
            ledgerApi.createManualJournal({
                branchId,
                voucherDate,
                narration: narration.trim() || undefined,
                lines: lines.map((l) => ({
                    ledgerId: l.ledgerId,
                    debitPaise: l.side === "DEBIT" ? rupeesToPaise(l.amount).toString() : "0",
                    creditPaise: l.side === "CREDIT" ? rupeesToPaise(l.amount).toString() : "0",
                    narration: l.narration.trim() || undefined,
                })),
            }),
        onSuccess: (result) => {
            toast.success(`Journal posted — ${result.voucherNumber}`);
            setPostedVoucherId(result.id);
            setVoucherOpen(true);
            setLines([newLine(), newLine()]);
            setNarration("");
        },
        onError: (error) =>
            toast.error(error instanceof Error ? error.message : "Could not post journal"),
    });

    const updateLine = (key: string, patch: Partial<LineDraft>) =>
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

    const removeLine = (key: string) =>
        setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.key !== key) : prev));

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-semibold">Manual Journal</h1>
                <p className="text-sm text-muted-foreground">
                    Post a free-form Dr/Cr voucher directly — for opening balances,
                    write-offs, corrections or anything the Bill/Receipt flows don&apos;t
                    cover. Must balance before it can be posted.
                </p>
            </div>

            <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Branch</label>
                    <Select value={branchId} onValueChange={setBranchId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.data?.data.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                    {b.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Voucher date</label>
                    <Input
                        type="date"
                        value={voucherDate}
                        onChange={(e) => setVoucherDate(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5 sm:col-span-3">
                    <label className="text-sm font-medium">
                        Narration <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder="What is this journal for?"
                        rows={2}
                        className="resize-none"
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                    <p className="text-sm font-semibold">Lines</p>
                    {totals.balanced ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="size-2 rounded-full bg-emerald-500" /> Balanced
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className="size-2 rounded-full bg-muted-foreground/40" /> Not balanced
                        </div>
                    )}
                </div>
                <div className="divide-y">
                    {lines.map((line) => (
                        <div
                            key={line.key}
                            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
                        >
                            <div className="sm:w-64">
                                <LedgerAccountPicker
                                    value={line.ledgerId}
                                    onChange={(id) => updateLine(line.key, { ledgerId: id })}
                                />
                            </div>
                            <Select
                                value={line.side}
                                onValueChange={(v) => updateLine(line.key, { side: v as "DEBIT" | "CREDIT" })}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEBIT">Debit</SelectItem>
                                    <SelectItem value="CREDIT">Credit</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                inputMode="decimal"
                                value={line.amount}
                                onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                                placeholder="0.00"
                                className="sm:w-32"
                            />
                            <Input
                                value={line.narration}
                                onChange={(e) => updateLine(line.key, { narration: e.target.value })}
                                placeholder="Line narration (optional)"
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={lines.length <= 2}
                                onClick={() => removeLine(line.key)}
                            >
                                <IconTrash size={15} />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLines((prev) => [...prev, newLine()])}
                    >
                        <IconPlus size={15} className="mr-1" /> Add line
                    </Button>
                    <div className="flex gap-6 text-sm">
                        <span>
                            Dr <span className="font-semibold tabular-nums">{money(totals.debit)}</span>
                        </span>
                        <span>
                            Cr <span className="font-semibold tabular-nums">{money(totals.credit)}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <Button disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
                    {create.isPending ? "Posting..." : "Post journal"}
                </Button>
            </div>

            <VoucherDialog
                open={voucherOpen}
                onOpenChange={setVoucherOpen}
                voucher={voucher.data}
                isLoading={voucher.isLoading}
                isError={voucher.isError}
                errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
            />
        </div>
    );
}
