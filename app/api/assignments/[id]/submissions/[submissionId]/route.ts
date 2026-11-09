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
    select: { id: true, maxScore: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  if (action === "REVIEWED" && score !== null && assignment.maxScore !== null && score > assignment.maxScore) {
    return NextResponse.json({ error: "คะแนนเกินคะแนนเต็มของงาน" }, { status: 400 });
  }

  try {
    // Atomic compare-and-set: concurrent upload/review requests cannot overwrite REVIEWED.
    const result = await prisma.submission.updateMany({
      where: { id: submissionId, assignmentId: assignment.id, status: { not: "REVIEWED" } },
      data: action === "RETURNED"
        ? { score: null, feedback, status: "RETURNED", reviewedAt: new Date() }
        : { score, feedback, status: "REVIEWED", reviewedAt: new Date() },
    });
    if (result.count !== 1) {
      const exists = await prisma.submission.findFirst({
        where: { id: submissionId, assignmentId: assignment.id },
        select: { id: true },
      });
      return NextResponse.json(
        { error: exists ? "งานนี้ตรวจและล็อกผลแล้ว หรือมีการเปลี่ยนสถานะพร้อมกัน กรุณาโหลดข้อมูลใหม่" : "ไม่พบรายการส่งงาน" },
        { status: exists ? 409 : 404 },
      );
    }
    const updated = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, status: true, score: true, feedback: true, reviewedAt: true },
    });
    return NextResponse.json(updated);

  } catch (error) {
    console.error("[AssignmentReview] update failed:", error);
    return NextResponse.json({ error: "บันทึกผลตรวจงานไม่สำเร็จ" }, { status: 500 });
  }
}
