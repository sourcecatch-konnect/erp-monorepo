export const today = () => new Date().toISOString().slice(0, 10);

export const money = (paise: string | bigint) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(Number(BigInt(paise)) / 100);

export const invoiceDate = (
    value: string | null | undefined,
) =>
    value
        ? new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(value))
        : "—";

export const formatLabel = (value: string) =>
    value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());