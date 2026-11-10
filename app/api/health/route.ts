import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json(
      {
        ok: true,
        service: "qr-exam-checker",
        database: "healthy",
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (err: unknown) {
    // Keep database host, schema details, and driver diagnostics out of the public response.
    console.error("[Health] Database connectivity check failed", err);
    return NextResponse.json(
      {
        ok: false,
        service: "qr-exam-checker",
        database: "unavailable",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
