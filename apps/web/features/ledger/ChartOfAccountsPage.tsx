"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@skerp/ui/components/select";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@skerp/ui/components/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Switch } from "@skerp/ui/components/switch";

import { useCan } from "@/features/auth";
import { ledgerApi, type LedgerAccount, type LedgerAccountGroup, type LedgerKind } from "./api/ledger.service";
import { ledgerKeys } from "./api/ledger.keys";
import { formatLabel } from "./voucher.util";

const GROUPS: LedgerAccountGroup[] = [
    "SUNDRY_DEBTOR",
    "SUNDRY_CREDITOR",
    "DIRECT_INCOME",
    "INDIRECT_INCOME",
    "DIRECT_EXPENSE",
    "INDIRECT_EXPENSE",
    "DUTIES_AND_TAXES",
    "BANK",
    "CASH",
    "CURRENT_ASSET",
    "CURRENT_LIABILITY",
];

function KindBadge({ kind }: { kind: LedgerKind }) {
    return (
        <span
            className={
                kind === "GL"
                    ? "inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    : "inline-flex items-center rounded-md border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-400"
            }
        >
            {kind === "GL" ? "GL" : "Party"}
        </span>
    );
}

type LedgerFormState = {
    name: string;
    group: LedgerAccountGroup | "";
    code: string;
};

const emptyForm: LedgerFormState = { name: "", group: "", code: "" };

/** Chart of Accounts — browse/search the double-entry ledger and create new
 *  GL heads by hand (party ledgers are lazy-created by the posting service
 *  and can only have their name/group/active flag edited here). */
export function ChartOfAccountsPage() {
    const canManage = useCan(PERMS.LEDGER.MANAGE);
    const queryClient = useQueryClient();

    const [kind, setKind] = React.useState<LedgerKind | "ALL">("ALL");
    const [group, setGroup] = React.useState<LedgerAccountGroup | "ALL">("ALL");
    const [search, setSearch] = React.useState("");
    const [activeOnly, setActiveOnly] = React.useState<"ALL" | "true" | "false">("true");

    const [createOpen, setCreateOpen] = React.useState(false);
    const [createForm, setCreateForm] = React.useState<LedgerFormState>(emptyForm);

    const [editing, setEditing] = React.useState<LedgerAccount | null>(null);
    const [editForm, setEditForm] = React.useState<LedgerFormState>(emptyForm);

    const filters = {
        kind: kind === "ALL" ? undefined : kind,
        group: group === "ALL" ? undefined : group,
        search: search.trim() || undefined,
        isActive: activeOnly === "ALL" ? undefined : activeOnly === "true",
    };

    const accounts = useQuery({
        queryKey: ledgerKeys.chartOfAccounts(filters),
        queryFn: () => ledgerApi.chartOfAccounts(filters),
    });

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ledgerKeys.all });

    const createLedger = useMutation({
        mutationFn: () =>
            ledgerApi.createGLLedger({
                name: createForm.name.trim(),
                group: createForm.group as LedgerAccountGroup,
                code: createForm.code.trim() ? createForm.code.trim().toUpperCase() : undefined,
            }),
        onSuccess: () => {
            invalidate();
            setCreateOpen(false);
            setCreateForm(emptyForm);
            toast.success("Ledger created");
        },
        onError: (error) =>
            toast.error(error instanceof Error ? error.message : "Could not create ledger"),
    });

    const updateLedger = useMutation({
        mutationFn: () =>
            ledgerApi.updateLedger(editing!.id, {
                name: editForm.name.trim(),
                group: editForm.group as LedgerAccountGroup,
                code: editForm.code.trim() ? editForm.code.trim().toUpperCase() : null,
            }),
        onSuccess: () => {
            invalidate();
            setEditing(null);
            toast.success("Ledger updated");
        },
        onError: (error) =>
            toast.error(error instanceof Error ? error.message : "Could not update ledger"),
    });

    const toggleActive = useMutation({
        mutationFn: (row: LedgerAccount) =>
            ledgerApi.updateLedger(row.id, { isActive: !row.isActive }),
        onSuccess: invalidate,
        onError: (error) =>
            toast.error(error instanceof Error ? error.message : "Could not update ledger"),
    });

    const openEdit = (row: LedgerAccount) => {
        setEditing(row);
        setEditForm({ name: row.name, group: row.group, code: row.code ?? "" });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold">Chart of Accounts</h1>
                    <p className="text-sm text-muted-foreground">
                        Every ledger the double-entry books post against — GL heads
                        (income, expense, tax, bank/cash) and party ledgers (customers,
                        transports, creditors), auto-created the first time they&apos;re used.
                    </p>
                </div>
                {canManage ? (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <IconPlus size={16} className="mr-1" /> New GL Ledger
                    </Button>
                ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <Input
                    placeholder="Search name or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64"
                />
                <Select value={kind} onValueChange={(v) => setKind(v as LedgerKind | "ALL")}>
                    <SelectTrigger className="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All kinds</SelectItem>
                        <SelectItem value="GL">GL</SelectItem>
                        <SelectItem value="PARTY">Party</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={group} onValueChange={(v) => setGroup(v as LedgerAccountGroup | "ALL")}>
                    <SelectTrigger className="w-52">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All groups</SelectItem>
                        {GROUPS.map((g) => (
                            <SelectItem key={g} value={g}>
                                {formatLabel(g)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={activeOnly} onValueChange={(v) => setActiveOnly(v as typeof activeOnly)}>
                    <SelectTrigger className="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Active only</SelectItem>
                        <SelectItem value="false">Inactive only</SelectItem>
                        <SelectItem value="ALL">All</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kind</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.isLoading
                            ? [0, 1, 2, 3, 4].map((row) => (
                                <TableRow key={row}>
                                    {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
                                        <TableCell key={cell}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                            : null}
                        {!accounts.isLoading && accounts.data?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                    No ledgers match these filters.
                                </TableCell>
                            </TableRow>
                        ) : null}
                        {accounts.data?.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <KindBadge kind={row.kind} />
                                </TableCell>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell className="text-muted-foreground">
                                    {formatLabel(row.group)}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {row.code ?? "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {row.branch?.name ?? "—"}
                                </TableCell>
                                <TableCell>
                                    {canManage ? (
                                        <Switch
                                            checked={row.isActive}
                                            onCheckedChange={() => toggleActive.mutate(row)}
                                            disabled={toggleActive.isPending}
                                        />
                                    ) : row.isActive ? (
                                        "Yes"
                                    ) : (
                                        "No"
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {canManage ? (
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                            Edit
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Create GL ledger */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New GL ledger</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={createForm.name}
                                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Warehouse Rent"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Group</label>
                            <Select
                                value={createForm.group}
                                onValueChange={(v) => setCreateForm((f) => ({ ...f, group: v as LedgerAccountGroup }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GROUPS.map((g) => (
                                        <SelectItem key={g} value={g}>
                                            {formatLabel(g)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Code <span className="text-muted-foreground">(optional)</span>
                            </label>
                            <Input
                                value={createForm.code}
                                onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                                placeholder="e.g. WAREHOUSE_RENT"
                                className="font-mono uppercase"
                            />
                            <p className="text-xs text-muted-foreground">
                                Only set this if other code will reference this ledger by a
                                stable name. Most manually-added heads don&apos;t need one.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createLedger.mutate()}
                            disabled={!createForm.name.trim() || !createForm.group || createLedger.isPending}
                        >
                            {createLedger.isPending ? "Creating..." : "Create ledger"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit ledger */}
            <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit ledger</DialogTitle>
                    </DialogHeader>
                    {editing?.kind === "PARTY" ? (
                        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-muted-foreground dark:border-amber-900 dark:bg-amber-950/30">
                            This is a party ledger, linked to a customer/vendor master
                            record. Renaming it here only changes the ledger&apos;s display
                            name — it does not rename the underlying master.
                        </p>
                    ) : null}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Group</label>
                            <Select
                                value={editForm.group}
                                onValueChange={(v) => setEditForm((f) => ({ ...f, group: v as LedgerAccountGroup }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {GROUPS.map((g) => (
                                        <SelectItem key={g} value={g}>
                                            {formatLabel(g)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {editing?.kind === "GL" ? (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">
                                    Code <span className="text-muted-foreground">(optional)</span>
                                </label>
                                <Input
                                    value={editForm.code}
                                    onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                                    className="font-mono uppercase"
                                />
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => updateLedger.mutate()}
                            disabled={!editForm.name.trim() || !editForm.group || updateLedger.isPending}
                        >
                            {updateLedger.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
