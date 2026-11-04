import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify LINE's X-Line-Signature against the exact, unmodified webhook body. */
export function verifyLineSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || typeof signature !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "base64");
  if (supplied.length !== expected.length || supplied.toString("base64") !== signature) return false;
  return timingSafeEqual(supplied, expected);
}
