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
  const ownerId = session.user.id;

  const { id, submissionId } = await context.params;
  const body = await request.json().catch(() => null);
  const action = body?.status === "RETURNED" ? "RETURNED" : body?.status === undefined || body?.status === "REVIEWED" ? "REVIEWED" : null;
  const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : "";
  if (!action || feedback.length > 5000) {
    return NextResponse.json({ error: "ความคิดเห็นหรือสถานะไม่ถูกต้อง" }, { status: 400 });
  }
  if (action === "RETURNED" && !feedback) {
    return NextResponse.json({ error: "กรุณาระบุเหตุผลหรือคำแนะนำก่อนส่งงานกลับให้นักเรียน" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId },
    select: { id: true, classId: true, gradeColumn: { select: { id: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const result = await tx.submission.updateMany({
        where: { id: submissionId, assignmentId: assignment.id, status: { not: "REVIEWED" } },
        data: {
          feedback,
          status: action,
          reviewedAt: new Date(),
        },
      });
      if (result.count !== 1) return { conflict: true as const };

      const updated = await tx.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, score: true, feedback: true, reviewedAt: true, student: { select: { classId: true } } },
      });
      if (!updated || updated.student.classId !== assignment.classId) {
        throw new Error("SUBMISSION_STUDENT_CLASS_MISMATCH");
      }
      const { student: _student, ...submission } = updated;
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

    return NextResponse.json({
      ...outcome.submission,
      gradeColumnLinked: Boolean(assignment.gradeColumn),
      gradebookScoreChanged: false,
    });
  } catch (error) {
    console.error("[AssignmentReview] update failed:", error);
    return NextResponse.json({ error: "บันทึกสถานะงานไม่สำเร็จ" }, { status: 500 });
  }
}
