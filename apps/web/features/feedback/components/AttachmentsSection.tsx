"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypeXls,
  IconHandFinger,
  IconPaperclip,
  IconPencil,
  IconX,
} from "@tabler/icons-react";
import { FEEDBACK_MAX_FILES, type FeedbackDocumentMime } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@skerp/ui/lib/util";
import {
  FILE_ACCEPT,
  classifyFile,
  formatBytes,
  releaseFile,
  type PendingFile,
} from "../lib/files";
import { fileToScreenshot, releaseScreenshot, type Screenshot } from "../lib/images";
import { AnnotateDialog } from "./AnnotateDialog";

const DOCUMENT_ICON: Record<FeedbackDocumentMime, typeof IconFileTypePdf> = {
  "application/pdf": IconFileTypePdf,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": IconFileTypeDocx,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": IconFileTypeXls,
};

function DocumentIcon({ mime }: { mime: FeedbackDocumentMime }) {
  const Icon = DOCUMENT_ICON[mime];
  return <Icon className="size-6 shrink-0 text-muted-foreground" aria-hidden />;
}

/** Turn picked / dropped / pasted files into pending files, telling the user about refused ones. */
export async function toPendingFiles(files: File[], room: number): Promise<PendingFile[]> {
  const added: PendingFile[] = [];
  for (const file of files) {
    if (added.length >= room) {
      toast.error(`You can attach up to ${FEEDBACK_MAX_FILES} files.`);
      break;
    }
    const kind = classifyFile(file);
    if (kind.kind === "refused") {
      toast.error(kind.reason);
      continue;
    }
    if (kind.kind === "image") {
      try {
        const shot = await fileToScreenshot(file);
        added.push({ kind: "image", id: shot.id, shot });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `We couldn't add "${file.name}".`,
        );
      }
      continue;
    }
    added.push({
      kind: "document",
      id: crypto.randomUUID(),
      doc: { file, name: file.name, mime: kind.mime },
    });
  }
  return added;
}

/**
 * "Show us": point at the part that is wrong, take a picture of the page, or
 * add your own file. Drag and drop and Ctrl+V anywhere in the form also work
 * (the form handles the paste). Pictures can be marked up before sending.
 */
export function AttachmentsSection({
  files,
  onFilesChange,
  onElementRemoved,
  onPoint,
}: {
  files: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  /** The picked-element picture was removed, so forget the picked element too. */
  onElementRemoved: () => void;
  /** Hides the panel, lets the user click the page, then reopens it. */
  onPoint: () => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [annotating, setAnnotating] = useState<Screenshot | null>(null);
  const room = FEEDBACK_MAX_FILES - files.length;
  const full = room <= 0;

  const addFiles = async (picked: File[]) => {
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const added = await toPendingFiles(picked, room);
      if (added.length > 0) onFilesChange([...files, ...added]);
    } finally {
      setBusy(false);
    }
  };


  const remove = (file: PendingFile) => {
    releaseFile(file);
    onFilesChange(files.filter((item) => item.id !== file.id));
    if (file.kind === "image" && file.shot.source === "element") onElementRemoved();
  };

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-card p-4 transition-colors duration-150",
        dragging ? "border-primary bg-primary/5" : "border-border",
      )}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Show us</h3>
        <p className="text-xs text-muted-foreground">
          A picture helps the team see the problem straight away.
        </p>
      </div>

      {/*
       * Pointing is the primary action: it needs no thought — click the thing
       * that is wrong and the picture, the section name and the element are
       * all filled in at once. It takes its own full-width row, and the two
       * fallbacks share the next one. This panel sits in a half-width column
       * beside the voice note, so three buttons abreast would not fit anyway.
       */}
      <div className="grid gap-2">
        <Button
          type="button"
          className="h-11 w-full"
          disabled={full || busy}
          onClick={onPoint}
        >
          <IconHandFinger className="size-4" aria-hidden />
          Point at the problem
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={full || busy}
          onClick={() => fileInput.current?.click()}
        >
          <IconPaperclip className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {busy ? "Adding…" : "Add a picture or file"}
          </span>
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            event.target.value = "";
            void addFiles(picked);
          }}
        />
      </div>

      {files.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {files.length} of {FEEDBACK_MAX_FILES} files
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {files.map((file, index) =>
              file.kind === "image" ? (
                <li key={file.id} className="space-y-1.5 rounded-md border border-border p-2">
                  {/* Local object URL — next/image can't optimise it. */}
                  <img
                    src={file.shot.url}
                    alt={`Picture ${index + 1}`}
                    className="h-24 w-full rounded-sm border border-border object-cover object-top"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 max-sm:h-10"
                      onClick={() => setAnnotating(file.shot)}
                    >
                      <IconPencil className="size-3.5" aria-hidden />
                      Mark
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 max-sm:h-10"
                      onClick={() => remove(file)}
                    >
                      <IconX className="size-3.5" aria-hidden />
                      Remove
                    </Button>
                  </div>
                </li>
              ) : (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2"
                >
                  <DocumentIcon mime={file.doc.mime} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{file.doc.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.doc.file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="max-sm:size-10"
                    onClick={() => remove(file)}
                    aria-label={`Remove ${file.doc.name}`}
                  >
                    <IconX className="size-4" aria-hidden />
                  </Button>
                </li>
              ),
            )}
          </ul>
        </>
      ) : (
        <p className="hidden text-xs text-muted-foreground sm:block">
          Tip: drop files here, or press{" "}
          <kbd className="rounded-sm border border-border bg-muted px-1">PrtScn</kbd> and then{" "}
          <kbd className="rounded-sm border border-border bg-muted px-1">Ctrl</kbd>+
          <kbd className="rounded-sm border border-border bg-muted px-1">V</kbd> in this form.
        </p>
      )}

      <AnnotateDialog
        shot={annotating}
        onClose={() => setAnnotating(null)}
        onSave={(next) => {
          if (!annotating) return;
          releaseScreenshot(annotating);
          onFilesChange(
            files.map((item) =>
              item.kind === "image" && item.shot.id === annotating.id
                ? { kind: "image", id: item.id, shot: next }
                : item,
            ),
          );
          setAnnotating(null);
        }}
      />
    </section>
  );
}
