import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const choices = new Set(["A", "B", "C", "D"]);

export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const exam = await prisma.exam.findFirst({ where: { id, ownerId: session.user.id }, select: { id: true } });
  if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: id },
    include: { student: { select: { id: true, rollNo: true, studentNo: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(attempts);
}

export async function POST(request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const answers = body?.answers;
  const exam = await prisma.exam.findFirst({
    where: { id, ownerId: session.user.id },
    include: { questions: { orderBy: { number: "asc" } } },
  });
  if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  if (!exam.classId || exam.questions.length === 0) return NextResponse.json({ error: "ข้อสอบยังไม่มีห้องเรียนหรือเฉลย" }, { status: 400 });
  if (!studentId || !answers || typeof answers !== "object" || Array.isArray(answers)) return NextResponse.json({ error: "ข้อมูลคำตอบไม่ครบ" }, { status: 400 });
  const student = await prisma.student.findFirst({ where: { id: studentId, classId: exam.classId, class: { ownerId: session.user.id } }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "นักเรียนไม่ได้อยู่ในห้องของข้อสอบนี้" }, { status: 400 });
  const normalized: Record<string, string> = {};
  for (const question of exam.questions) {
    const answer = answers[String(question.number)];
    if (answer !== "" && answer !== null && !choices.has(answer)) return NextResponse.json({ error: "รูปแบบคำตอบไม่ถูกต้อง" }, { status: 400 });
    normalized[String(question.number)] = answer || "";
  }
  const score = exam.questions.reduce((sum, q) => sum + (normalized[String(q.number)] === q.answer ? 1 : 0), 0);
  const prior = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId } }, select: { status: true } });
  if (prior?.status === "CONFIRMED") return NextResponse.json({ error: "ผลสอบนี้ยืนยันแล้ว ไม่สามารถเขียนทับได้" }, { status: 409 });
  const attempt = await prisma.examAttempt.upsert({
    where: { examId_studentId: { examId: id, studentId } },
    create: { examId: id, studentId, answersJson: normalized, score, status: "READY_TO_CONFIRM" },
    update: { answersJson: normalized, score, status: "READY_TO_CONFIRM" },
    include: { student: { select: { id: true, rollNo: true, studentNo: true, name: true } } },
  });
  return NextResponse.json(attempt, { status: prior ? 200 : 201 });
}
