import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SystemIncidentSeverity } from "@prisma/client";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function isSystemOwner(): Promise<boolean> {
  const configuredOwner = process.env.SYSTEM_OWNER_EMAIL;
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
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
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
}
