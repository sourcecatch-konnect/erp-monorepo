import { IconFileInvoice } from "@tabler/icons-react";

export function BillingPageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="rounded-md border bg-card p-5">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div className="flex items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <IconFileInvoice size={22} />
                    </span>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
        </div>
    );
}