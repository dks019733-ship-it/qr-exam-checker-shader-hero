import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; attemptId: string }> };

export async function POST(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, attemptId } = await context.params;
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, examId: id, exam: { ownerId: session.user.id } },
  });
  if (!attempt) return NextResponse.json({ error: "ไม่พบผลสอบ" }, { status: 404 });
  if (attempt.status === "CONFIRMED") return NextResponse.json(attempt);
  const [confirmed, exam] = await prisma.$transaction([
    prisma.examAttempt.update({ where: { id: attemptId }, data: { status: "CONFIRMED" } }),
    prisma.exam.findUnique({ where: { id }, select: { gradeColumn: { select: { id: true, maxScore: true } }, _count: { select: { questions: true } } } }),
  ]);
  if (exam?.gradeColumn && confirmed.score !== null && exam._count.questions > 0) {
    const score = Math.min(exam.gradeColumn.maxScore, (confirmed.score / exam._count.questions) * exam.gradeColumn.maxScore);
    await prisma.gradeScore.upsert({
      where: { columnId_studentId: { columnId: exam.gradeColumn.id, studentId: confirmed.studentId } },
      create: { columnId: exam.gradeColumn.id, studentId: confirmed.studentId, score },
      update: { score },
    });
  }
  return NextResponse.json(confirmed);
}
