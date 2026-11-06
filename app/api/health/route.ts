import { NextResponse } from "next/server";
import { prisma, ensureDatabaseSchema } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDatabaseSchema();
  try {
    const userCheck = await prisma.user.findFirst({
      select: { id: true, schoolKey: true },
    });
    return NextResponse.json({
      ok: true,
      service: "qr-exam-checker",
      database: "healthy",
      schoolKeyColumnVerified: true,
      sampleUserId: userCheck ? userCheck.id : null,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      service: "qr-exam-checker",
      database: "error",
      error: errorMsg,
    }, { status: 500 });
  }
}
