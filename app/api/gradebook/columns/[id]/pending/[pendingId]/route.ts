import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; pendingId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pendingId } = await params;
  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  if (!studentId) return NextResponse.json({ error: "กรุณาเลือกนักเรียนที่ต้องการจับคู่" }, { status: 400 });

  const pending = await prisma.pendingFormScore.findFirst({
    where: { id: pendingId, columnId: id, column: { ownerId: session.user.id } },
    select: { id: true, columnId: true, responseId: true, score: true, column: { select: { classId: true } } },
  });
  if (!pending) return NextResponse.json({ error: "ไม่พบคะแนนที่รอจับคู่" }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, classId: pending.column.classId, isActive: true }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "นักเรียนไม่ได้อยู่ในห้องนี้หรือถูกปิดใช้งาน" }, { status: 400 });

  await prisma.$transaction([
    prisma.gradeScore.upsert({
      where: { columnId_studentId: { columnId: pending.columnId, studentId } },
      create: { columnId: pending.columnId, studentId, score: pending.score },
      update: { score: pending.score },
    }),
    prisma.formResponseReview.upsert({
      where: { columnId_responseId: { columnId: pending.columnId, responseId: pending.responseId } },
      create: { columnId: pending.columnId, responseId: pending.responseId, studentId, score: pending.score, questionScores: {} },
      update: { studentId, score: pending.score },
    }),
    prisma.pendingFormScore.delete({ where: { id: pending.id } }),
  ]);
  return NextResponse.json({ ok: true, score: pending.score });
}
