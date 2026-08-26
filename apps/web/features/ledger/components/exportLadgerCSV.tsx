import type { LedgerEntryRow } from "@skerp/types";

import type { BalanceConvention } from "../components/LedgerTable";

type Args = {
    filename: string;
    openingBalance: number;
    entries: LedgerEntryRow[];
    balanceConvention: BalanceConvention;
};

function isDr(balance: number, convention: BalanceConvention): boolean {
    if (!convention) return true;
    return balance >= 0 === (convention === "asset");
}

function isDebitEntry(direction: LedgerEntryRow["direction"], convention: BalanceConvention): boolean {
    if (!convention) return direction === "IN";
    return convention === "liability" ? direction === "OUT" : direction === "IN";
}

/** amountPaise -> rupees, 2dp, no thousands separator (CSV should stay
 * locale-neutral so it opens cleanly in Excel/Sheets regardless of the
 * user's regional settings). */
function rupees(paise: number): string {
    return (paise / 100).toFixed(2);
}

function csvCell(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
}

/**
 * Builds a CSV of the currently-loaded ledger rows and triggers a browser
 * download. Client-side only — fine for the row counts a single date-range
 * report holds; if ledgers grow large enough to need true pagination, this
 * should move to a server-generated export instead.
 */
export function downloadLedgerCsv({ filename, openingBalance, entries, balanceConvention }: Args): void {
    const header = ["Date", "Description", "Reference", "Source", "Debit", "Credit", "Balance"];
    const rows: string[][] = [
        ["", "Opening balance", "", "", "", "", `${rupees(openingBalance)} ${isDr(openingBalance, balanceConvention) ? "Dr" : "Cr"}`],
    ];

    for (const e of entries) {
        const debit = isDebitEntry(e.direction, balanceConvention);
        const reference = (e as LedgerEntryRow & { reference?: string }).reference ?? "";
        rows.push([
            new Date(e.occurredAt).toLocaleDateString("en-IN"),
            e.description,
            reference,
            e.sourceType,
            debit ? rupees(e.amountPaise) : "",
            !debit ? rupees(e.amountPaise) : "",
            `${rupees(e.runningBalance)} ${isDr(e.runningBalance, balanceConvention) ? "Dr" : "Cr"}`,
        ]);
    }

    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}