"use client";

import * as React from "react";
import { IconDownload, IconEye, IconLoader2, IconPrinter } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@skerp/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";

import { runPdfAction, type PdfAction } from "@/lib/pdf-actions";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

/** The same "Print / PDF" menu as the LR and GRN detail screens: download,
 * print or preview, each with or without the letterhead (logo header and
 * watermark — "without" is for pre-printed stationery). */
export function ReportPrintMenu({
    downloadPdf,
    previewPath,
    fileName,
    disabled,
    label = "Print / PDF",
}: {
    /** Fetches the PDF from the server. */
    downloadPdf: (withLetterhead: boolean) => Promise<Blob>;
    /** Server path (without the /api prefix) that returns the printable HTML. */
    previewPath: (withLetterhead: boolean) => string;
    /** Base file name, without ".pdf"; "-plain" is added for no letterhead. */
    fileName: string;
    disabled?: boolean;
    /** Button text, for pages that offer more than one printable report. */
    label?: string;
}) {
    const [busy, setBusy] = React.useState(false);

    const handlePdf = async (action: PdfAction, withLetterhead: boolean) => {
        try {
            setBusy(true);
            const blob = await downloadPdf(withLetterhead);
            runPdfAction(blob, action, `${fileName}${withLetterhead ? "" : "-plain"}.pdf`);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const openPreview = (withLetterhead: boolean) => {
        window.open(`/api${previewPath(withLetterhead)}`, "_blank", "noopener,noreferrer");
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={disabled || busy}>
                    {busy ? (
                        <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                        <IconPrinter size={16} />
                    )}
                    {busy ? "Preparing…" : label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Download</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handlePdf("download", true)}>
                    <IconDownload size={16} className="mr-2" /> With letterhead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePdf("download", false)}>
                    <IconDownload size={16} className="mr-2" /> Without letterhead
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Print</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handlePdf("print", true)}>
                    <IconPrinter size={16} className="mr-2" /> With letterhead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePdf("print", false)}>
                    <IconPrinter size={16} className="mr-2" /> Without letterhead
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Preview</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => openPreview(true)}>
                    <IconEye size={16} className="mr-2" /> With letterhead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openPreview(false)}>
                    <IconEye size={16} className="mr-2" /> Without letterhead
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
