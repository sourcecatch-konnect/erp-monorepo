import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

const region = process.env.AWS_S3_REGION || "ap-south-1";
const bucket = process.env.AWS_S3_BUCKET || "";

// Credentials are read from the standard AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// env vars by the SDK default provider chain — no need to pass them explicitly.
export const s3Client = new S3Client({ region });

export const isS3Configured = (): boolean =>
  Boolean(bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const requireBucket = (): string => {
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }
  return bucket;
};

const PRESIGN_TTL_SECONDS = 300; // 5 minutes

/** Presigned PUT URL — the browser uploads bytes straight to S3 with this. */
export const presignUpload = async (key: string, mime: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: key,
    ContentType: mime,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_TTL_SECONDS });
};

/** Presigned GET URL — the browser downloads bytes straight from S3 with this. */
export const presignDownload = async (
  key: string,
  filename?: string,
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: requireBucket(),
    Key: key,
    ...(filename
      ? {
          ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
        }
      : {}),
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_TTL_SECONDS });
};

/** Verify an object exists post-upload and read back its real size + type. */
export const headObject = async (
  key: string,
): Promise<{ size: number; contentType?: string }> => {
  const res = await s3Client.send(
    new HeadObjectCommand({ Bucket: requireBucket(), Key: key }),
  );
  return { size: res.ContentLength ?? 0, contentType: res.ContentType };
};

export const deleteObject = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }),
  );
};

/** Stream an object's bytes — used by the antivirus worker to scan them. */
export const getObjectStream = async (key: string): Promise<Readable> => {
  const res = await s3Client.send(
    new GetObjectCommand({ Bucket: requireBucket(), Key: key }),
  );
  return res.Body as Readable;
};
