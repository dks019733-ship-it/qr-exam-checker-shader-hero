import { createHash, createHmac } from "crypto";

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

function rfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

let cachedConfig: { endpoint: string; bucket: string; accessKey: string; secretKey: string } | null = null;

export function isObjectStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
  );
}

function getConfig() {
  if (!isObjectStorageConfigured()) throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");
  if (!cachedConfig) {
    cachedConfig = {
      endpoint: "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
      bucket: process.env.R2_BUCKET_NAME!,
      accessKey: process.env.R2_ACCESS_KEY_ID!,
      secretKey: process.env.R2_SECRET_ACCESS_KEY!,
    };
  }
  return cachedConfig;
}

function signedUrl(method: "PUT" | "GET" | "HEAD", objectKey: string, expiresIn: number) {
  const config = getConfig();
  const url = new URL(config.endpoint);
  const canonicalUri = "/" + rfc3986(config.bucket) + "/" + objectKey.split("/").map(rfc3986).join("/");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const credentialScope = dateStamp + "/" + region + "/" + service + "/aws4_request";

  const parameters: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", config.accessKey + "/" + credentialScope],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = parameters
    .map(([key, value]) => [rfc3986(key), rfc3986(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value)
    .join("&");
  const canonicalHeaders = "host:" + url.host + "\n";
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const dateKey = hmac("AWS4" + config.secretKey, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return config.endpoint + canonicalUri + "?" + canonicalQuery + "&X-Amz-Signature=" + signature;
}

export function getUploadPolicy() {
  return { maxBytes: MAX_UPLOAD_BYTES, allowedTypes: [...ALLOWED_TYPES] };
}

export function sanitizeUploadName(value: string) {
  const leaf = value.split(/[\\/]/).pop() || "upload";
  return leaf.normalize("NFKC").replace(/[^\\p{L}\\p{N}._() -]/gu, "_").slice(0, 160) || "upload";
}

export function validateUploadInput(contentType: string, sizeBytes: number) {
  if (!ALLOWED_TYPES.has(contentType)) return "ไฟล์ประเภทนี้ยังไม่รองรับ";
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return "ขนาดไฟล์ต้องไม่เกิน " + Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024)) + " MB";
  }
  return null;
}

export async function createUploadUrl(objectKey: string, _contentType: string) {
  return signedUrl("PUT", objectKey, 300);
}

export async function createDownloadUrl(objectKey: string) {
  return signedUrl("GET", objectKey, 180);
}

export async function verifyStoredObject(objectKey: string) {
  const response = await fetch(signedUrl("HEAD", objectKey, 60), { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error("OBJECT_STORAGE_HEAD_FAILED_" + response.status);
  return {
    sizeBytes: Number(response.headers.get("content-length") || 0),
    contentType: response.headers.get("content-type") || "",
  };
}
