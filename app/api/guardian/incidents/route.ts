import { NextResponse } from "next/server";
import { isSystemOwner } from "@/lib/system-guardian";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isSystemOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const incidents = await prisma.systemIncident.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 25,
      select: {
        id: true,
        source: true,
        severity: true,
        status: true,
        title: true,
        summary: true,
        route: true,
        httpStatus: true,
        occurrenceCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
        resolvedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      incidents,
      checkedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "Unable to load system incidents",
    }, { status: 503 });
  }
}
