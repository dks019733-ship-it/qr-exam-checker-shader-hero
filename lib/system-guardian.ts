import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SystemIncidentSeverity } from "@prisma/client";
import { pushLineMessage } from "@/lib/line-guardian";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function isSystemOwner(): Promise<boolean> {
  const configuredOwner = process.env.SYSTEM_OWNER_EMAIL?.trim();
  if (!configuredOwner) return false;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });

  if (!user?.email || !user.emailVerified) return false;
  return normalizeEmail(user.email) === normalizeEmail(configuredOwner);
}

export function isValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization) return false;

  // Require exactly one non-whitespace bearer token; reject malformed headers.
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) return false;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(match[1], "utf8");
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function recordSystemIncident(input: {
  source: string;
  severity: SystemIncidentSeverity;
  title: string;
  summary: string;
  route?: string;
  httpStatus?: number;
}): Promise<void> {
  const fingerprint = createHash("sha256")
    .update([input.source, input.title, input.route ?? "", String(input.httpStatus ?? "")].join(":"))
    .digest("hex");

  const previous = await prisma.systemIncident.findUnique({
    where: { fingerprint },
    select: { status: true },
  });

  await prisma.systemIncident.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      source: input.source,
      severity: input.severity,
      title: input.title.slice(0, 160),
      summary: input.summary.slice(0, 2000),
      route: input.route?.slice(0, 200),
      httpStatus: input.httpStatus,
    },
    update: {
      severity: input.severity,
      status: "OPEN",
      summary: input.summary.slice(0, 2000),
      occurrenceCount: { increment: 1 },
      lastSeenAt: new Date(),
      resolvedAt: null,
    },
  });

  const ownerLineId = process.env.LINE_OWNER_USER_ID;
  if (ownerLineId && (!previous || previous.status === "RESOLVED")) {
    const notification = [
      `System Guardian: ${input.severity}`,
      input.title.slice(0, 160),
      input.route ? `เส้นทาง: ${input.route}` : "",
      `เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
      "พิมพ์ “สถานะระบบ” ใน LINE เพื่อดูผลตรวจล่าสุด",
    ].filter(Boolean).join("\n");

    // Notification is best-effort and must never turn an incident write into
    // an application failure when LINE is unavailable.
    try {
      await pushLineMessage(ownerLineId, notification);
    } catch {
      // Intentionally suppress provider failures; incident persistence is primary.
    }
  }
}
