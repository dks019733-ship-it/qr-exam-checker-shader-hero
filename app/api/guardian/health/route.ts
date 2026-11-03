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
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      checks: { database: "ok" },
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      ok: false,
      checks: { database: "error" },
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
}
