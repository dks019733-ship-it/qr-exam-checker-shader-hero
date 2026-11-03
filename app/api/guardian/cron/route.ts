import { NextResponse } from "next/server";
import { isValidCronSecret, recordSystemIncident } from "@/lib/system-guardian";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      checks: { database: "ok" },
      checkedAt: new Date().toISOString(),
    });
  } catch {
    try {
      await recordSystemIncident({
        source: "guardian-cron",
        severity: "CRITICAL",
        title: "Database readiness check failed",
        summary: "The scheduled System Guardian check could not reach the database.",
        route: "/api/guardian/cron",
        httpStatus: 503,
      });
    } catch {
      // Do not expose database or persistence internals in the response.
    }

    return NextResponse.json({
      ok: false,
      checks: { database: "error" },
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
}
