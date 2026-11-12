import { normalizeSupabaseApiOrigin } from "./supabase-storage-url.mjs";

const configuredUploadLimit = Number(process.env.UPLOAD_MAX_BYTES);
const MAX_UPLOAD_BYTES = Number.isSafeInteger(configuredUploadLimit) && configuredUploadLimit > 0
  ? Math.min(configuredUploadLimit, 10 * 1024 * 1024)
  : 10 * 1024 * 1024;

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
  serviceKey: string;
};

function getConfig(): StorageConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "assignment-files";
  if (!supabaseUrl || !serviceKey || !bucket) {
    throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");
  }

  let apiOrigin: string;
  try {
    apiOrigin = normalizeSupabaseApiOrigin(supabaseUrl);
  } catch {
    throw new Error("OBJECT_STORAGE_CONFIGURATION_INVALID");
  }

  return { baseUrl: apiOrigin + "/storage/v1", bucket, serviceKey };
}

export function isObjectStorageConfigured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

function safeObjectPath(objectKey: string) {
  const segments = objectKey.split("/");
  if (
    !objectKey ||
    objectKey.startsWith("/") ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !["assignment-files", "submission-files"].includes(segments[0])
  ) {
    throw new Error("OBJECT_STORAGE_PATH_INVALID");
  }
  return segments.map(encodeURIComponent).join("/");
}

function storageHeaders(config: StorageConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: "Bearer " + config.serviceKey,
    ...extra,
  };
}

async function storageRequest(
  path: string,
  init: RequestInit = {},
) {
  const config = getConfig();
  const response = await fetch(config.baseUrl + path, {
    ...init,
    headers: storageHeaders(config, init.headers as Record<string, string> | undefined),
    cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("SUPABASE_STORAGE_REQUEST_FAILED_" + response.status);
  }
  return response;
}

export function getUploadPolicy() {
  return { maxBytes: MAX_UPLOAD_BYTES, allowedTypes: [...ALLOWED_TYPES] };
}

export function sanitizeUploadName(value: string) {
  const leaf = value.split(/[\\\\/]/).pop() || "upload";
  return leaf.normalize("NFKC").replace(/[^\p{L}\p{N}._() -]/gu, "_").slice(0, 160) || "upload";
}

export function validateUploadInput(contentType: string, sizeBytes: number) {
  if (!ALLOWED_TYPES.has(contentType)) return "ไฟล์ประเภทนี้ยังไม่รองรับ";
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return "ขนาดไฟล์ต้องไม่เกิน " + Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024)) + " MB";
  }
  return null;
}

export async function createUploadUrl(objectKey: string, contentType: string) {
  if (!ALLOWED_TYPES.has(contentType)) throw new Error("OBJECT_STORAGE_CONTENT_TYPE_NOT_ALLOWED");
  const config = getConfig();
  const path = safeObjectPath(objectKey);
  const response = await storageRequest(
    "/object/upload/sign/" + encodeURIComponent(config.bucket) + "/" + path,
    // Supabase binds the declared MIME type into the signed upload metadata.
    // It must match the browser's subsequent PUT Content-Type.
    { method: "POST", headers: { "Content-Type": contentType } },
  );
  const data = await response.json() as { url?: string };
  if (typeof data.url !== "string" || !data.url) throw new Error("SUPABASE_STORAGE_SIGNED_UPLOAD_URL_MISSING");
  // Supabase signed upload URLs are one-time, path-scoped tokens and expire after two hours.
  // The browser uploads directly to Storage; the service-role key never leaves this module.
  const uploadUrl = new URL(config.baseUrl + data.url).toString();
  return uploadUrl;
}

export async function deleteStoredObject(objectKey: string) {
  const config = getConfig();
  const path = safeObjectPath(objectKey);
  await storageRequest("/object/" + encodeURIComponent(config.bucket), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [decodeURIComponent(path)] }),
  });
}

export async function createDownloadUrl(objectKey: string) {
  const config = getConfig();
  const path = safeObjectPath(objectKey);
  const response = await storageRequest(
    "/object/sign/" + encodeURIComponent(config.bucket) + "/" + path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 180 }) },
  );
  const data = await response.json() as { signedURL?: string };
  if (typeof data.signedURL !== "string" || !data.signedURL) {
    throw new Error("SUPABASE_STORAGE_SIGNED_DOWNLOAD_URL_MISSING");
  }
  return new URL(config.baseUrl + data.signedURL).toString();
}

export async function verifyStoredObject(objectKey: string, expectedContentType: string) {
  const config = getConfig();
  const path = safeObjectPath(objectKey);
  const objectPath = "/object/authenticated/" + encodeURIComponent(config.bucket) + "/" + path;
  const response = await storageRequest(objectPath, { method: "HEAD" });
  const sizeBytes = Number(response.headers.get("content-length") || 0);
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("OBJECT_STORAGE_SIZE_INVALID");
  }
  if (contentType !== expectedContentType) throw new Error("OBJECT_STORAGE_CONTENT_TYPE_MISMATCH");

  const sampleResponse = await storageRequest(objectPath, {
    headers: { Range: "bytes=0-15" },
  });
  if (sampleResponse.status !== 206) {
    await sampleResponse.body?.cancel();
    throw new Error("OBJECT_STORAGE_RANGE_NOT_SUPPORTED");
  }
  const bytes = new Uint8Array(await sampleResponse.arrayBuffer());
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  let signatureValid = false;
  switch (expectedContentType) {
    case "application/pdf":
      signatureValid = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
      break;
    case "image/jpeg":
      signatureValid = starts(0xff, 0xd8, 0xff);
      break;
    case "image/png":
      signatureValid = starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      break;
    case "image/webp":
      signatureValid = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      break;
    case "application/msword":
      signatureValid = starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      signatureValid = starts(0x50, 0x4b, 0x03, 0x04);
      break;
  }
  if (!signatureValid) throw new Error("OBJECT_STORAGE_FILE_SIGNATURE_INVALID");
  return { sizeBytes, contentType };
}
