import { NextResponse } from "next/server";
import { prisma, ensureDatabaseSchema } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDatabaseSchema();
  try {
    const [userCheck, subjectCheck] = await Promise.all([
      prisma.user.findFirst({ select: { id: true, schoolKey: true } }),
      prisma.subject.findFirst({ select: { id: true } }).catch(() => null),
    ]);
    return NextResponse.json({
      ok: true,
      service: "qr-exam-checker",
      database: "healthy",
      schoolKeyColumnVerified: true,
      subjectTableVerified: true,
      sampleUserId: userCheck ? userCheck.id : null,
      sampleSubjectId: subjectCheck ? subjectCheck.id : null,
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
