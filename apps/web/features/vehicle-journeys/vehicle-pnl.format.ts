import { formatPaise } from "@/lib/money";

export const profitTone = (paise: string) =>
    BigInt(paise) < 0n ? "text-destructive" : "text-emerald-700";

export const formatPct = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(1)}%`;

export const formatMoneyOrDash = (paise: string | null) =>
    paise === null ? "—" : formatPaise(paise);

export const formatMonth = (yyyyMm: string) => {
    const [year, month] = yyyyMm.split("-");
    return new Intl.DateTimeFormat("en-IN", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
};

/** Paise string → rupees number, for charts only (display precision). */
export const paiseToRupees = (paise: string) => Number(paise) / 100;
