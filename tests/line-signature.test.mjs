import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyLineSignature } from "../lib/line-signature.mjs";

const secret = "test-only-line-channel-secret";
const rawBody = JSON.stringify({ destination: "U00000000000000000000000000000000", events: [] });
const validSignature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

test("accepts a valid LINE HMAC-SHA256 signature", () => {
  process.env.LINE_CHANNEL_SECRET = secret;
  assert.equal(verifyLineSignature(rawBody, validSignature), true);
});

test("rejects a signature when the request body has changed", () => {
  process.env.LINE_CHANNEL_SECRET = secret;
  assert.equal(verifyLineSignature(`${rawBody} `, validSignature), false);
});

test("rejects an invalid or non-canonical base64 signature", () => {
  process.env.LINE_CHANNEL_SECRET = secret;
  assert.equal(verifyLineSignature(rawBody, "not-a-signature"), false);
  assert.equal(verifyLineSignature(rawBody, `${validSignature}!`), false);
});

test("fails closed when the channel secret is missing", () => {
  delete process.env.LINE_CHANNEL_SECRET;
  assert.equal(verifyLineSignature(rawBody, validSignature), false);
});
