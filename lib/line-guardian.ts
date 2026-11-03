import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API = "https://api.line.me/v2/bot";

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64");
  } catch {
    return false;
  }

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function lineRequest(path: string, body: unknown): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const response = await fetch(`${LINE_API}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function replyLineMessage(replyToken: string, text: string): Promise<boolean> {
  return lineRequest("message/reply", {
    replyToken,
    messages: [{ type: "text", text: text.slice(0, 4500) }],
  });
}

export function pushLineMessage(userId: string, text: string): Promise<boolean> {
  return lineRequest("message/push", {
    to: userId,
    messages: [{ type: "text", text: text.slice(0, 4500) }],
  });
}
