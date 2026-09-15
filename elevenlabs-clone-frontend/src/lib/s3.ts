import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env } from "~/env";

const isAwsConfigured =
  Boolean(env.AWS_ACCESS_KEY_ID) &&
  env.AWS_ACCESS_KEY_ID !== "local_access_key" &&
  Boolean(env.AWS_SECRET_ACCESS_KEY) &&
  env.AWS_SECRET_ACCESS_KEY !== "local_secret_key" &&
  Boolean(env.S3_BUCKET_NAME) &&
  env.S3_BUCKET_NAME !== "elevenlabs-clone-local";

let s3Client: S3Client | null = null;

if (isAwsConfigured) {
  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function getPresignedUrl({ key }: { key: string }): Promise<string> {
  if (!key) return "";

  // If already an absolute or relative web URL
  if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("/api/audio/")) {
    return key;
  }

  if (s3Client) {
    try {
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
      });
      return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (err) {
      console.warn("Failed to get S3 presigned URL, falling back to local audio route:", err);
    }
  }

  // Local fallback: serve from local audio API
  return `/api/audio/${encodeURIComponent(key)}`;
}

export async function getUploadUrl(
  fileType: string,
): Promise<{ uploadUrl: string; s3Key: string }> {
  const extension = fileType === "audio/mp3" ? "mp3" : "wav";
  const s3Key = `uploads/${Date.now()}-${randomUUID()}.${extension}`;

  if (s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: s3Key,
        ContentType: fileType,
      });
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return { uploadUrl, s3Key };
    } catch (err) {
      console.warn("Failed to get S3 upload URL, falling back to local upload handler:", err);
    }
  }

  // Local fallback upload endpoint
  return {
    uploadUrl: `/api/upload?key=${encodeURIComponent(s3Key)}`,
    s3Key,
  };
}
