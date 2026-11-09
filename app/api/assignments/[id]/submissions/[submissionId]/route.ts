import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; submissionId: string }> },
) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });

  const { id, submissionId } = await context.params;
  const body = await request.json().catch(() => null);
  const action = body?.status === "RETURNED" ? "RETURNED" : body?.status === undefined || body?.status === "REVIEWED" ? "REVIEWED" : null;
  const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : "";
  const score = body?.score === "" || body?.score === null || body?.score === undefined ? null : Number(body.score);
  if (!action || feedback.length > 5000 || (score !== null && (!Number.isFinite(score) || score < 0))) {
    return NextResponse.json({ error: "คะแนน ความคิดเห็น หรือสถานะไม่ถูกต้อง" }, { status: 400 });
  }
  if (action === "RETURNED" && !feedback) {
    return NextResponse.json({ error: "กรุณาระบุเหตุผลหรือคำแนะนำก่อนส่งงานกลับให้นักเรียน" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, maxScore: true, classId: true, gradeColumn: { select: { id: true, classId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  if (action === "REVIEWED" && score !== null && assignment.maxScore !== null && score > assignment.maxScore) {
    return NextResponse.json({ error: "คะแนนเกินคะแนนเต็มของงาน" }, { status: 400 });
  }

  try {
    // Keep the submission state and gradebook score in one transaction.
    const outcome = await prisma.$transaction(async (tx) => {
      const result = await tx.submission.updateMany({
        where: { id: submissionId, assignmentId: assignment.id, status: { not: "REVIEWED" } },
        data: action === "RETURNED"
          ? { score: null, feedback, status: "RETURNED", reviewedAt: new Date() }
          : { score, feedback, status: "REVIEWED", reviewedAt: new Date() },
      });
      if (result.count !== 1) return { conflict: true as const };

      const updated = await tx.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, score: true, feedback: true, reviewedAt: true, studentId: true, student: { select: { classId: true } } },
      });
      if (!updated || updated.student.classId !== assignment.classId) {
        throw new Error("SUBMISSION_STUDENT_CLASS_MISMATCH");
      }

      if (action === "REVIEWED" && assignment.gradeColumn) {
        if (assignment.gradeColumn.classId !== updated.student.classId) {
          throw new Error("GRADE_COLUMN_CLASS_MISMATCH");
        }
        await tx.gradeScore.upsert({
          where: { columnId_studentId: { columnId: assignment.gradeColumn.id, studentId: updated.studentId } },
          create: { columnId: assignment.gradeColumn.id, studentId: updated.studentId, score },
          update: { score },
        });
      }
      const { student: _student, studentId: _studentId, ...submission } = updated;
      return { conflict: false as const, submission };
    });
    if (outcome.conflict) {
      const exists = await prisma.submission.findFirst({
        where: { id: submissionId, assignmentId: assignment.id },
        select: { id: true },
      });
      return NextResponse.json(
        { error: exists ? "งานนี้ตรวจและล็อกผลแล้ว หรือมีการเปลี่ยนสถานะพร้อมกัน กรุณาโหลดข้อมูลใหม่" : "ไม่พบรายการส่งงาน" },
        { status: exists ? 409 : 404 },
      );
    }
    return NextResponse.json({ ...outcome.submission, gradebookSynced: action === "REVIEWED" && Boolean(assignment.gradeColumn) });

  } catch (error) {
    console.error("[AssignmentReview] update failed:", error);
    return NextResponse.json({ error: "บันทึกผลตรวจงานไม่สำเร็จ" }, { status: 500 });
  }
}
