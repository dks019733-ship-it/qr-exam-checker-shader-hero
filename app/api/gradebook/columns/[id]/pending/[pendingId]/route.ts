import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFormScoreDestination, getOtherFormScoreColumnIds } from "@/lib/gradebook-form-destination";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; pendingId: string }> }) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pendingId } = await params;
  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  if (!studentId) return NextResponse.json({ error: "กรุณาเลือกนักเรียนที่ต้องการจับคู่" }, { status: 400 });

  const pending = await prisma.pendingFormScore.findFirst({
    where: { id: pendingId, columnId: id, column: { ownerId: session.user.id } },
    select: { id: true, columnId: true, responseId: true, score: true, column: { select: { id: true, ownerId: true, classId: true, title: true, period: true, maxScore: true } } },
  });
  if (!pending) return NextResponse.json({ error: "ไม่พบคะแนนที่รอจับคู่" }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, class: { ownerId: session.user.id }, isActive: true }, select: { id: true, classId: true } });
  if (!student) return NextResponse.json({ error: "ไม่พบนักเรียนในห้องเรียนของครู" }, { status: 400 });
  const destinationColumnId = await getFormScoreDestination(pending.column, student.classId);
  const staleColumnIds = await getOtherFormScoreColumnIds(pending.column.id, destinationColumnId);

  await prisma.$transaction([
    ...(staleColumnIds.length ? [prisma.gradeScore.deleteMany({
      where: { columnId: { in: staleColumnIds }, studentId, manualOverride: false },
    })] : []),
    prisma.gradeScore.upsert({
      where: { columnId_studentId: { columnId: destinationColumnId, studentId } },
      create: { columnId: destinationColumnId, studentId, score: pending.score, manualOverride: true },
      update: { score: pending.score, manualOverride: true },
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
