import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });
  const { id } = await context.params;
  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, title: true, mode: true, maxScore: true, dueAt: true, classId: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  const submissions = await prisma.submission.findMany({
    where: { assignmentId: assignment.id },
    include: {
      student: { select: { id: true, rollNo: true, studentNo: true, name: true } },
      files: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
    },
    orderBy: [{ submittedAt: "desc" }],
  });
  const receivedStudentIds = new Set(submissions.map((item) => item.studentId));
  const students = assignment.mode === "TEACHER_CHECK"
    ? await prisma.student.findMany({
        where: { classId: assignment.classId, isActive: true },
        select: { id: true, rollNo: true, studentNo: true, name: true },
        orderBy: [{ rollNo: "asc" }, { studentNo: "asc" }],
      })
    : [];
  return NextResponse.json({
    assignment,
    unreceivedStudents: students.filter((student) => !receivedStudentIds.has(student.id)),
    submissions: submissions.map((item) => ({
      id: item.id,
      status: item.status,
      submittedAt: item.submittedAt.toISOString(),
      isLate: Boolean(assignment.dueAt && item.submittedAt > assignment.dueAt),
      score: item.score,
      feedback: item.feedback,
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      student: item.student,
      files: item.files,
    })),
  });
}


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  if (!studentId) return NextResponse.json({ error: "กรุณาระบุนักเรียน" }, { status: 400 });

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id, mode: "TEACHER_CHECK", status: "PUBLISHED" },
    select: { id: true, classId: true, maxScore: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานตรวจในชั้นเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  const student = await prisma.student.findFirst({
    where: { id: studentId, classId: assignment.classId, isActive: true },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "นักเรียนไม่อยู่ในห้องเรียนนี้" }, { status: 404 });

  const hasScore = Object.prototype.hasOwnProperty.call(body, "score");
  const hasFeedback = Object.prototype.hasOwnProperty.call(body, "feedback");
  const hasReviewInput = hasScore || hasFeedback;
  const score = !hasScore || body.score === "" || body.score === null ? null : Number(body.score);
  const feedback = hasFeedback && typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (hasScore && score !== null && (!Number.isFinite(score) || score < 0 || (assignment.maxScore !== null && score > assignment.maxScore))) {
    return NextResponse.json({ error: "คะแนนไม่ถูกต้อง" }, { status: 400 });
  }
  if (hasFeedback && (typeof body.feedback !== "string" || body.feedback.length > 5000)) {
    return NextResponse.json({ error: "ความคิดเห็นต้องเป็นข้อความไม่เกิน 5,000 ตัวอักษร" }, { status: 400 });
  }

  const now = new Date();
  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
    select: { id: true, status: true },
  });
  if (existing?.status === "RETURNED" && !hasReviewInput) {
    const transitioned = await prisma.submission.updateMany({
      where: { id: existing.id, status: "RETURNED" },
      data: { status: "SUBMITTED", submittedAt: now, score: null, feedback: "", reviewedAt: null },
    });
    if (transitioned.count !== 1) {
      return NextResponse.json({ error: "สถานะงานเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
    }
    const saved = await prisma.submission.findUniqueOrThrow({
      where: { id: existing.id },
      select: { id: true, status: true, submittedAt: true, score: true, feedback: true, reviewedAt: true },
    });
    return NextResponse.json(saved);
  }

  const saved = await prisma.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
        create: {
          assignmentId: assignment.id,
          studentId: student.id,
          status: hasReviewInput ? "REVIEWED" : "SUBMITTED",
          submittedAt: now,
          ...(hasReviewInput ? {
            reviewedAt: now,
            score,
            feedback,
          } : {}),
        },
        update: hasReviewInput ? {
          status: "REVIEWED",
          reviewedAt: now,
          ...(hasScore ? { score } : {}),
          ...(hasFeedback ? { feedback } : {}),
        } : {},
        select: { id: true, status: true, submittedAt: true, score: true, feedback: true, reviewedAt: true },
      });
  return NextResponse.json(saved);
}
