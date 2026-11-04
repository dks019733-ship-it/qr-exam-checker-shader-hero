export class PayloadTooLargeError extends Error {
  constructor() {
    super("Webhook payload exceeds the configured limit");
    this.name = "PayloadTooLargeError";
  }
}

export async function readLimitedBody(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}
