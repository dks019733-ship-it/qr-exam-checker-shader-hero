import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const choices = new Set(["A", "B", "C", "D"]);

export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const exam = await prisma.exam.findFirst({
    where: { id, ownerId: session.user.id },
    include: { class: true, questions: { orderBy: { number: "asc" } }, _count: { select: { attempts: true } } },
  });
  if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  return NextResponse.json(exam);
}

export async function PUT(request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const classId = typeof body?.classId === "string" ? body.classId : "";
  const questions = body?.questions;
  if (!title || title.length > 200 || subject.length > 200 || !classId ||
      !Array.isArray(questions) || questions.length < 1 || questions.length > 100 ||
      questions.some((q: any, i: number) => q?.number !== i + 1 || typeof q.answer !== "string" || !choices.has(q.answer))) {
    return NextResponse.json({ error: "กรอกข้อมูลข้อสอบและเฉลยให้ครบ โดยเฉลยต้องเป็น A, B, C หรือ D" }, { status: 400 });
  }
  const exam = await prisma.exam.findFirst({ where: { id, ownerId: session.user.id }, include: { _count: { select: { attempts: true } } } });
  if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });
  if (exam._count.attempts > 0) return NextResponse.json({ error: "ข้อสอบนี้มีผลสอบแล้ว จึงแก้เฉลยไม่ได้" }, { status: 409 });
  const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId: session.user.id }, select: { id: true } });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียน" }, { status: 404 });
  const updated = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { examId: id } });
    return tx.exam.update({
      where: { id },
      data: { title, subject, classId, status: "READY", questions: { create: questions.map((q: { number: number; answer: string }) => ({ number: q.number, answer: q.answer })) } },
      include: { class: true, questions: { orderBy: { number: "asc" } } },
    });
  });
  return NextResponse.json(updated);
}
