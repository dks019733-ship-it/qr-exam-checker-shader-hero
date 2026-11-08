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
  return signedUrl("PUT", objectKey, 300);
}

export async function createDownloadUrl(objectKey: string) {
  return signedUrl("GET", objectKey, 180);
}

export async function verifyStoredObject(objectKey: string, expectedContentType: string) {
  const response = await fetch(signedUrl("HEAD", objectKey, 60), { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error("OBJECT_STORAGE_HEAD_FAILED_" + response.status);
  const sizeBytes = Number(response.headers.get("content-length") || 0);
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== expectedContentType) throw new Error("OBJECT_STORAGE_CONTENT_TYPE_MISMATCH");

  const sampleResponse = await fetch(signedUrl("GET", objectKey, 60), {
    headers: { Range: "bytes=0-15" },
    cache: "no-store",
  });
  if (!sampleResponse.ok && sampleResponse.status !== 206) throw new Error("OBJECT_STORAGE_SAMPLE_FAILED");
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
