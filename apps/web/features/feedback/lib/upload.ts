import type { FeedbackFileRequest } from "@skerp/types";
import { feedbackApi } from "../feedback.service";
import type { PageAttachments } from "./files";

/**
 * Files are sent after the feedback item exists, so a failed upload never
 * loses the report: request a presigned URL → PUT to storage → confirm.
 * Two at a time, with progress per file; failed ones can be retried.
 */

export type UploadJob = {
  id: string;
  label: string;
  blob: Blob;
  request: FeedbackFileRequest;
};

export type UploadStatus = "waiting" | "uploading" | "done" | "failed";

export type UploadProgress = {
  id: string;
  label: string;
  status: UploadStatus;
  /** 0…1 while the file is being sent to storage. */
  progress: number;
  error?: string;
};

const CONCURRENCY = 2;

export function uploadJobs(attachments: PageAttachments): UploadJob[] {
  const jobs: UploadJob[] = [];
  if (attachments.voice) {
    const { voice } = attachments;
    jobs.push({
      id: voice.id,
      label: "Voice note",
      blob: voice.blob,
      request: {
        kind: "voice",
        mime: voice.mime,
        sizeBytes: voice.blob.size,
        durationSec: voice.durationSec,
      },
    });
  }
  attachments.files.forEach((file, index) => {
    if (file.kind === "image") {
      jobs.push({
        id: file.id,
        label: `Picture ${index + 1}`,
        blob: file.shot.blob,
        request: {
          kind: "image",
          mime: "image/jpeg",
          sizeBytes: file.shot.blob.size,
          width: file.shot.width,
          height: file.shot.height,
        },
      });
    } else {
      jobs.push({
        id: file.id,
        label: file.doc.name,
        blob: file.doc.file,
        request: {
          kind: "document",
          mime: file.doc.mime,
          sizeBytes: file.doc.file.size,
          name: file.doc.name,
        },
      });
    }
  });
  return jobs;
}

export const waitingProgress = (jobs: UploadJob[]): UploadProgress[] =>
  jobs.map((job) => ({ id: job.id, label: job.label, status: "waiting", progress: 0 }));

async function uploadOne(
  feedbackId: string,
  job: UploadJob,
  onUpdate: (id: string, patch: Partial<UploadProgress>) => void,
) {
  onUpdate(job.id, { status: "uploading", progress: 0, error: undefined });
  try {
    const { attachmentId, uploadUrl } = await feedbackApi.requestFile(feedbackId, job.request);
    await feedbackApi.uploadToStorage(uploadUrl, job.blob, job.request.mime, (progress) =>
      onUpdate(job.id, { progress }),
    );
    await feedbackApi.completeFile(
      feedbackId,
      attachmentId,
      job.request.kind === "voice" ? { durationSec: job.request.durationSec } : {},
    );
    onUpdate(job.id, { status: "done", progress: 1 });
  } catch (error) {
    onUpdate(job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
}

/** Sends every job; never throws — each job ends as "done" or "failed". */
export async function runUploads(
  feedbackId: string,
  jobs: UploadJob[],
  onUpdate: (id: string, patch: Partial<UploadProgress>) => void,
): Promise<void> {
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      await uploadOne(feedbackId, job, onUpdate);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
