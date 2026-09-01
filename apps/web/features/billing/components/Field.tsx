import * as React from "react";

export function Field({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <label className={`space-y-1.5 text-xs font-medium ${className ?? ""}`}>
            <span>{label}</span>
            {children}
        </label>
    );
}