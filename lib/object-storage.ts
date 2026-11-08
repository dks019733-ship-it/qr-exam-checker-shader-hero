import {
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES) > 0
  ? Number(process.env.UPLOAD_MAX_BYTES)
  : 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

let client: S3Client | null = null;

export function getUploadPolicy() {
  return { maxBytes: MAX_UPLOAD_BYTES, allowedTypes: [...ALLOWED_TYPES] };
}

export function isObjectStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
  );
}

function getClient() {
  if (!isObjectStorageConfigured()) throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function sanitizeUploadName(value: string) {
  const leaf = value.split(/[\\/]/).pop() || "upload";
  return leaf.normalize("NFKC").replace(/[^\\p{L}\\p{N}._() -]/gu, "_").slice(0, 160) || "upload";
}

export function validateUploadInput(contentType: string, sizeBytes: number) {
  if (!ALLOWED_TYPES.has(contentType)) return "ไฟล์ประเภทนี้ยังไม่รองรับ";
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return `ขนาดไฟล์ต้องไม่เกิน ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`;
  }
  return null;
}

export async function createUploadUrl(objectKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 300 });
}

export async function createDownloadUrl(objectKey: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 180 });
}

export async function verifyStoredObject(objectKey: string) {
  const result = await getClient().send(new HeadObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
  }));
  return {
    sizeBytes: result.ContentLength ?? 0,
    contentType: result.ContentType ?? "",
  };
}
