"use client";

import * as React from "react";
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel: string;
    destructive?: boolean;
    isPending?: boolean;
    onConfirm: (reason: string) => void | Promise<void>;
};

export default function ReasonDialog({
    open, onOpenChange, title, description,
    confirmLabel, destructive, isPending, onConfirm,
}: Props) {
    const [reason, setReason] = React.useState("");
    const [touched, setTouched] = React.useState(false);

    React.useEffect(() => {
        if (open) { setReason(""); setTouched(false); }
    }, [open]);

    const tooShort = reason.trim().length < 3;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                        Reason <span className="text-red-600">*</span>
                    </label>
                    <Textarea
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder="Give a clear reason…"
                        aria-invalid={touched && tooShort}
                    />
                    {touched && tooShort && (
                        <p className="text-xs text-red-600">
                            Please give a reason (min 3 characters).
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className={destructive ? "bg-red-600 text-white hover:bg-red-700" : undefined}
                        disabled={isPending || tooShort}
                        onClick={() => { setTouched(true); if (!tooShort) void onConfirm(reason.trim()); }}
                    >
                        {isPending ? "Working…" : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}