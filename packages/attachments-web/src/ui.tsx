"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconDownload,
  IconFile,
  IconPhoto,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import type { AttachmentApi } from "./api";
import { attachmentKeys } from "./keys";
import type { Attachment, AntivirusStatus } from "./types";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const STATUS_LABEL: Record<AntivirusStatus, string> = {
  PENDING: "Scanning…",
  CLEAN: "Ready",
  INFECTED: "Infected",
  FAILED: "Scan failed",
};

const STATUS_CLASS: Record<AntivirusStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  CLEAN: "bg-primary/10 text-primary",
  INFECTED: "bg-destructive/10 text-destructive",
  FAILED: "bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: AntivirusStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Returns a poll interval while any attachment is still being scanned. */
const pollWhilePending = (data: Attachment[] | undefined): number | false =>
  data?.some((a) => a.uploaded && a.antivirusStatus === "PENDING")
    ? 3000
    : false;

type SharedProps = {
  api: AttachmentApi;
  entityType: string;
  entityId: string;
};

/* ------------------------------------------------------------------ */
/* AttachmentPanel — general multi-file widget for any host entity.    */
/* ------------------------------------------------------------------ */

export function AttachmentPanel({ api, entityType, entityId }: SharedProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const queryKey = attachmentKeys.byEntity(entityType, entityId);

  const list = useQuery({
    queryKey,
    queryFn: () => api.listByEntity(entityType, entityId),
    refetchInterval: (query) =>
      pollWhilePending(query.state.data as Attachment[] | undefined),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.upload(
        {
          entityType,
          entityId,
          originalName: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
        file,
        setProgress,
      ),
    onSuccess: () => {
      toast.success("File uploaded — scanning for viruses");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || "Upload failed";
      toast.error(message);
    },
    onSettled: () => setProgress(null),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      toast.success("Attachment removed");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Could not remove attachment"),
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => uploadMutation.mutate(file));
    },
    [uploadMutation],
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const handleDownload = async (att: Attachment) => {
    try {
      setDownloadingId(att.id);

      const url = await api.getDownloadUrl(att.id);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = att.originalName || "attachment.pdf";
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("File is not available for download yet");
    } finally {
      setDownloadingId(null);
    }
  };

  const items = list.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-card p-6 text-center"
      >
        <IconUpload className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag &amp; drop files here, or
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending
            ? progress !== null
              ? `Uploading ${progress}%`
              : "Uploading…"
            : "Choose files"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col divide-y divide-border border border-border">
        {list.isLoading ? (
          [0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="size-8" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No attachments yet.
          </p>
        ) : (
          items.map((att) => (
            <div key={att.id} className="flex items-center gap-3 p-3">
              <IconFile className="size-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {att.originalName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(att.sizeBytes)}
                </p>
              </div>
              <StatusBadge status={att.antivirusStatus} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Download"
                disabled={
                  att.antivirusStatus !== "CLEAN" || downloadingId === att.id
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleDownload(att);
                }}
              >
                {downloadingId === att.id ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                ) : (
                  <IconDownload className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Delete"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeMutation.mutate(att.id);
                }}
              >
                <IconTrash />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ProfilePhotoUploader — single-image avatar variant (test surface).  */
/* ------------------------------------------------------------------ */

export function ProfilePhotoUploader({
  api,
  entityType,
  entityId,
}: SharedProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const queryKey = attachmentKeys.byEntity(entityType, entityId);

  const list = useQuery({
    queryKey,
    queryFn: () => api.listByEntity(entityType, entityId),
    refetchInterval: (query) =>
      pollWhilePending(query.state.data as Attachment[] | undefined),
  });

  // Most recent attachment is the current photo (list is sorted desc).
  const current: Attachment | undefined = list.data?.[0];

  // Presigned GET URL for the current photo, only once it is CLEAN.
  const photo = useQuery({
    queryKey: [...queryKey, "url", current?.id, current?.antivirusStatus],
    queryFn: () => api.getDownloadUrl(current!.id),
    enabled: Boolean(current && current.antivirusStatus === "CLEAN"),
    staleTime: 4 * 60 * 1000, // presigned URL lives ~5 min
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const previousId = current?.id;
      const uploaded = await api.upload(
        {
          entityType,
          entityId,
          originalName: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
        file,
        setProgress,
      );
      // Single-photo semantics: drop the previous one.
      if (previousId) await api.remove(previousId).catch(() => undefined);
      return uploaded;
    },
    onSuccess: () => {
      toast.success("Photo uploaded — scanning for viruses");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || "Upload failed";
      toast.error(message);
    },
    onSettled: () => setProgress(null),
  });

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    uploadMutation.mutate(file);
  };

  const status = current?.antivirusStatus;
  const uploading = uploadMutation.isPending;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border bg-muted">
        {uploading || status === "PENDING" ? (
          <Skeleton className="size-full rounded-full" />
        ) : status === "CLEAN" && photo.data ? (
          <img
            src={photo.data}
            alt="Profile"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <IconPhoto className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading
            ? progress !== null
              ? `Uploading ${progress}%`
              : "Uploading…"
            : current
              ? "Change photo"
              : "Upload photo"}
        </Button>
        {status === "PENDING" && (
          <span className="text-xs text-muted-foreground">
            Scanning for viruses…
          </span>
        )}
        {(status === "INFECTED" || status === "FAILED") && (
          <span className="text-xs text-destructive">
            {current?.scanError || "This file was rejected."}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
