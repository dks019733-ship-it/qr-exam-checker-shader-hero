import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyLineSignature } from "../lib/line-signature.mjs";
import { PayloadTooLargeError, readLimitedBody } from "../lib/line-webhook-body.mjs";

const secret = "test-only-line-channel-secret";
const rawBody = JSON.stringify({ destination: "U00000000000000000000000000000000", events: [] });
const validSignature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

test("accepts a valid LINE HMAC-SHA256 signature", () => {
  process.env.LINE_CHANNEL_SECRET = secret;
  assert.equal(verifyLineSignature(rawBody, validSignature), true);
});

test("verifies the exact raw bytes without UTF-8 normalization", () => {
  process.env.LINE_CHANNEL_SECRET = secret;
  const rawBytes = Buffer.from([0x7b, 0x22, 0x76, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]);
  const signature = createHmac("sha256", secret).update(rawBytes).digest("base64");
  assert.equal(verifyLineSignature(rawBytes, signature), true);
  assert.equal(verifyLineSignature(Buffer.from(rawBytes.toString("utf8")), signature), false);
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

test("reads a bounded request body across chunks", async () => {
  const request = new Request("https://example.test/webhook", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0x7b, 0x7d]));
        controller.close();
      },
    }),
    duplex: "half",
  });

  assert.deepEqual(await readLimitedBody(request, 2), Buffer.from("{}"));
});

test("rejects oversized streamed bodies before buffering the full payload", async () => {
  let cancelled = false;
  const request = new Request("https://example.test/webhook", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(3));
      },
      cancel() {
        cancelled = true;
      },
    }),
    duplex: "half",
  });

  await assert.rejects(readLimitedBody(request, 2), PayloadTooLargeError);
  assert.equal(cancelled, true);
});
