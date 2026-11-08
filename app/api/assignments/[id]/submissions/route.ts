import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json({
    assignment,
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
