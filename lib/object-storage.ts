import { createHash, createHmac } from "crypto";

const configuredUploadLimit = Number(process.env.UPLOAD_MAX_BYTES);
const MAX_UPLOAD_BYTES = Number.isSafeInteger(configuredUploadLimit) && configuredUploadLimit > 0
  ? configuredUploadLimit
  : 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type StorageConfig = {
  baseUrl: string;
  bucket: string;
  serviceRoleKey: string;
};

function getConfig(): StorageConfig {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !bucket || !serviceRoleKey) {
    throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("OBJECT_STORAGE_INVALID_SUPABASE_URL");
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error("OBJECT_STORAGE_INVALID_SUPABASE_URL");
  }

  return { baseUrl: parsedUrl.origin, bucket, serviceRoleKey };
}

export function isObjectStorageConfigured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

function encodeObjectKey(objectKey: string) {
  return objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function storagePath(path: string) {
  return "/storage/v1" + path;
}

async function storageRequest(path: string, init: RequestInit = {}) {
  const config = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceRoleKey);
  headers.set("Authorization", "Bearer " + config.serviceRoleKey);

  return fetch(config.baseUrl + storagePath(path), {
    ...init,
    headers,
    cache: "no-store",
  });
}

function bucketObjectPath(objectKey: string) {
  const config = getConfig();
  return "/" + encodeURIComponent(config.bucket) + "/" + encodeObjectKey(objectKey);
}

function signedStorageUrl(path: unknown, expectedPrefix: string) {
  if (typeof path !== "string" || !path.startsWith(expectedPrefix) || path.startsWith("//")) {
    throw new Error("OBJECT_STORAGE_INVALID_SIGNED_URL");
  }
  const config = getConfig();
  return config.baseUrl + storagePath(path);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function startsWithBytes(bytes: Uint8Array, ...values: number[]) {
  return values.every((value, index) => bytes[index] === value);
}

export function getUploadPolicy() {
  return { maxBytes: MAX_UPLOAD_BYTES, allowedTypes: [...ALLOWED_TYPES] };
}

export function sanitizeUploadName(value: string) {
  const leaf = value.split(/[\\/]/).pop() || "upload";
  return leaf.normalize("NFKC").replace(/[^\p{L}\p{N}._() -]/gu, "_").slice(0, 160) || "upload";
}

export function validateUploadInput(contentType: string, sizeBytes: number) {
  if (!ALLOWED_TYPES.has(contentType)) return "ไฟล์ประเภทนี้ยังไม่รองรับ";
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return "ขนาดไฟล์ต้องไม่เกิน " + Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024)) + " MB";
  }
  return null;
}

export async function createUploadUrl(objectKey: string, _contentType: string) {
  const response = await storageRequest("/object/upload/sign" + bucketObjectPath(objectKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("OBJECT_STORAGE_SIGN_UPLOAD_FAILED_" + response.status);

  const result = await response.json() as { url?: unknown };
  return signedStorageUrl(result.url, "/object/upload/sign/");
}

export async function deleteStoredObject(objectKey: string) {
  const response = await storageRequest("/object" + bucketObjectPath(objectKey), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("OBJECT_STORAGE_DELETE_FAILED_" + response.status);
  }
}

export async function createDownloadUrl(objectKey: string) {
  const response = await storageRequest("/object/sign" + bucketObjectPath(objectKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 180 }),
  });
  if (!response.ok) throw new Error("OBJECT_STORAGE_SIGN_DOWNLOAD_FAILED_" + response.status);

  const result = await response.json() as { signedURL?: unknown };
  return signedStorageUrl(result.signedURL, "/object/sign/");
}

export async function verifyStoredObject(objectKey: string, expectedContentType: string) {
  const path = "/object" + bucketObjectPath(objectKey);
  const response = await storageRequest(path, { method: "HEAD" });
  if (!response.ok) throw new Error("OBJECT_STORAGE_HEAD_FAILED_" + response.status);

  const sizeBytes = Number(response.headers.get("content-length") || 0);
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error("OBJECT_STORAGE_INVALID_SIZE");
  if (contentType !== expectedContentType) throw new Error("OBJECT_STORAGE_CONTENT_TYPE_MISMATCH");

  const sampleResponse = await storageRequest(path, {
    method: "GET",
    headers: { Range: "bytes=0-15" },
  });
  if (sampleResponse.status !== 206) {
    await sampleResponse.body?.cancel();
    throw new Error("OBJECT_STORAGE_RANGE_NOT_SUPPORTED");
  }

  const bytes = new Uint8Array(await sampleResponse.arrayBuffer());
  let signatureValid = false;
  switch (expectedContentType) {
    case "application/pdf":
      signatureValid = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
      break;
    case "image/jpeg":
      signatureValid = startsWithBytes(bytes, 0xff, 0xd8, 0xff);
      break;
    case "image/png":
      signatureValid = startsWithBytes(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      break;
    case "image/webp":
      signatureValid = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      break;
    case "application/msword":
      signatureValid = startsWithBytes(bytes, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      signatureValid = startsWithBytes(bytes, 0x50, 0x4b, 0x03, 0x04);
      break;
  }

  if (!signatureValid) throw new Error("OBJECT_STORAGE_FILE_SIGNATURE_INVALID");
  return { sizeBytes, contentType };
}
