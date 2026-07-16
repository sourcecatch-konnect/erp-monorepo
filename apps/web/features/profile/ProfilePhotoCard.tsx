"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconCamera,
  IconLoader2,
  IconPhoto,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { attachmentKeys, type Attachment } from "@skerp/attachments-web";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@skerp/ui/components/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { attachmentApi } from "@/features/attachments/attachment.client";

const ENTITY_TYPE = "User";

/** Largest accepted image — mirrors the server's default attachment cap. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Props = {
  userId: string;
  /** Initials shown while there is no photo. */
  initials: string;
};

/**
 * Profile avatar card. Shows a skeleton until the photo's presigned URL
 * resolves, lets the user replace it (the previous object is deleted from the
 * bucket server-side), and remove it entirely.
 */
export function ProfilePhotoCard({ userId, initials }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const queryKey = attachmentKeys.byEntity(ENTITY_TYPE, userId);

  const list = useQuery({
    queryKey,
    queryFn: () => attachmentApi.listByEntity(ENTITY_TYPE, userId),
  });

  // Most recent attachment is the current photo (server sorts desc).
  const current: Attachment | undefined = list.data?.[0];

  // Presigned GET URL for the current photo, only once it is CLEAN.
  const photo = useQuery({
    queryKey: [...queryKey, "url", current?.id, current?.antivirusStatus],
    queryFn: () => attachmentApi.getDownloadUrl(current!.id),
    enabled: Boolean(current && current.antivirusStatus === "CLEAN"),
    staleTime: 4 * 60 * 1000, // presigned URL lives ~5 min
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const previousId = current?.id;
      const uploaded = await attachmentApi.upload(
        {
          entityType: ENTITY_TYPE,
          entityId: userId,
          originalName: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
        file,
        setProgress,
      );
      // Single-photo semantics: drop the previous object from the bucket.
      if (previousId) {
        await attachmentApi.remove(previousId).catch(() => undefined);
      }
      return uploaded;
    },
    onSuccess: () => {
      toast.success("Profile photo updated");
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
    mutationFn: (id: string) => attachmentApi.remove(id),
    onSuccess: () => {
      toast.success("Profile photo removed");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Could not remove photo"),
  });

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 10 MB or smaller");
      return;
    }
    uploadMutation.mutate(file);
  };

  const status = current?.antivirusStatus;
  const uploading = uploadMutation.isPending;
  const removing = removeMutation.isPending;
  const busy = uploading || removing;

  // Skeleton while the list loads, the file uploads, the scan runs, or the
  // presigned URL for an existing CLEAN photo is still resolving.
  const showSkeleton =
    list.isLoading ||
    uploading ||
    status === "PENDING" ||
    (status === "CLEAN" && photo.isLoading);

  const hasPhoto = status === "CLEAN" && Boolean(photo.data);
  const rejected = status === "INFECTED" || status === "FAILED";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile photo</CardTitle>
        <CardDescription>
          PNG, JPG or WEBP up to 10 MB. Replacing it deletes the old image.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="group relative size-32">
          <div className="size-full overflow-hidden rounded-full border border-border bg-muted">
            {showSkeleton ? (
              <Skeleton className="size-full rounded-full" />
            ) : hasPhoto ? (
              <img
                src={photo.data}
                alt="Profile"
                className="size-full object-cover"
              />
            ) : initials ? (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {initials}
              </div>
            ) : (
              <div className="flex size-full items-center justify-center">
                <IconPhoto className="size-10 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Hover overlay quick action */}
          {!busy && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 text-background opacity-0 transition-opacity group-hover:opacity-100"
              title="Change photo"
            >
              <IconCamera className="size-7" />
            </button>
          )}
        </div>

        {uploading && progress !== null && (
          <span className="text-xs text-muted-foreground">
            Uploading {progress}%…
          </span>
        )}
        {rejected && (
          <span className="text-center text-xs text-destructive">
            {current?.scanError || "This file was rejected."}
          </span>
        )}

        <div className="flex items-center gap-2">
          {hasPhoto ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  {busy ? (
                    <IconLoader2 className="animate-spin" />
                  ) : (
                    <IconCamera />
                  )}
                  Edit photo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
                  <IconUpload className="size-4" />
                  Change photo
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => current && removeMutation.mutate(current.id)}
                >
                  <IconTrash className="size-4" />
                  Remove photo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {uploading ? (
                <IconLoader2 className="animate-spin" />
              ) : (
                <IconUpload />
              )}
              Upload photo
            </Button>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
}
