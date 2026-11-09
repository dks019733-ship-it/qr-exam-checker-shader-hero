import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";

export async function GET() {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const cookieStore = await cookies();
  const token = cookieStore.get("student_token")?.value;
  if (!token) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

  const payload = verifyStudentToken(token);
  if (!payload?.studentId) return NextResponse.json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

  const student = await prisma.student.findFirst({
    where: { id: payload.studentId, classId: payload.classId, isActive: true },
    select: { id: true, classId: true },
  });
  if (!student) return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียน" }, { status: 404 });

  const assignments = await prisma.assignment.findMany({
    where: {
      classId: student.classId,
      status: "PUBLISHED",
    },
    include: {
      teachingAssignment: { include: { subject: { select: { code: true, name: true } }, owner: { select: { name: true } } } },
      files: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
      gradeColumn: {
        select: {
          title: true,
          maxScore: true,
          scores: {
            where: { studentId: student.id },
            select: { score: true },
            take: 1,
          },
        },
      },
      submissions: {
        where: { studentId: student.id },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          score: true,
          feedback: true,
          files: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    assignments: assignments.map((assignment) => {
      const submission = assignment.submissions[0] ?? null;
      return {
        id: assignment.id,
        title: assignment.gradeColumn?.title ?? assignment.title,
        description: assignment.description,
        mode: assignment.mode,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        maxScore: assignment.gradeColumn?.maxScore ?? assignment.maxScore,
        googleFormUrl: assignment.googleFormUrl,
        subject: assignment.teachingAssignment.subject,
        teacher: assignment.teachingAssignment.owner.name || "ครูผู้สอน",
        files: assignment.files,
        submission: submission ? {
          id: submission.id,
          status: submission.status,
          submittedAt: submission.submittedAt.toISOString(),
          isLate: Boolean(assignment.dueAt && submission.submittedAt > assignment.dueAt),
          score: assignment.gradeColumn ? (assignment.gradeColumn.scores[0]?.score ?? null) : submission.score,
          feedback: submission.feedback,
          files: submission.files,
        } : null,
      };
    }),
  });
}
