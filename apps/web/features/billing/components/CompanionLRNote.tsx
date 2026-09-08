export type CompanionLRNoteProps = {
    lrs: Array<{ id: string; lrNumber: string }>;
    freightOwnerLRNumber?: string | null;
};

/** LRs on the same truck as a billed LR but carrying no charge of their own
 * — their freight rides on the LR that owns it. */
export function CompanionLRNote({ lrs, freightOwnerLRNumber }: CompanionLRNoteProps) {
    if (lrs.length === 0) return null;
    return (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
                Also on this truck — no separate charge
                {freightOwnerLRNumber
                    ? ` (freight billed via ${freightOwnerLRNumber})`
                    : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {lrs.map((lr) => (
                    <span
                        key={lr.id}
                        className="rounded-sm border bg-background px-2 py-1 text-xs font-medium"
                    >
                        {lr.lrNumber}
                    </span>
                ))}
            </div>
        </div>
    );
}
