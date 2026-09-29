import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const periods = ["MIDTERM", "AFTER_MIDTERM"] as const;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = session.user.id;
  const classId = new URL(request.url).searchParams.get("classId");
  const [classes, exams, googleForms] = await Promise.all([
    prisma.class.findMany({ where: { ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.exam.findMany({ where: { ownerId, ...(classId ? { classId } : {}) }, select: { id: true, title: true, subject: true, classId: true, gradeColumn: { select: { id: true } }, _count: { select: { questions: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.googleForm.findMany({ where: { ownerId }, include: { material: { select: { title: true, subject: true } }, gradeColumn: { select: { id: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!classId) return NextResponse.json({ classes, exams, googleForms });
  const classroom = classes.find((item) => item.id === classId);
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  const [students, columns] = await Promise.all([
    prisma.student.findMany({ where: { classId, isActive: true }, select: { id: true, rollNo: true, studentNo: true, name: true }, orderBy: [{ rollNo: "asc" }, { studentNo: "asc" }] }),
    prisma.gradeColumn.findMany({ where: { ownerId, classId }, include: { scores: true, exam: { select: { title: true } }, googleForm: { include: { material: { select: { title: true } } } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ classes, classroom, students, columns, exams, googleForms });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const period = body?.period;
  const maxScore = Number(body?.maxScore);
  const sourceType = body?.sourceType;
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  if (!classId || !title || title.length > 120 || !periods.includes(period) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return NextResponse.json({ error: "กรุณากรอกชื่องาน ช่วงคะแนน และคะแนนเต็มให้ถูกต้อง" }, { status: 400 });
  }
  const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId: session.user.id }, select: { id: true } });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  let examId: string | undefined;
  let googleFormId: string | undefined;
  let importScores: { studentId: string; score: number }[] = [];
  if (sourceType === "exam") {
    const exam = await prisma.exam.findFirst({ where: { id: sourceId, ownerId: session.user.id, classId }, include: { _count: { select: { questions: true } }, attempts: { where: { score: { not: null }, status: "CONFIRMED" }, select: { studentId: true, score: true } }, gradeColumn: { select: { id: true } } } });
    if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบในห้องนี้" }, { status: 404 });
    if (exam.gradeColumn) return NextResponse.json({ error: "ข้อสอบนี้เชื่อมกับสมุดคะแนนแล้ว" }, { status: 409 });
    examId = exam.id;
    importScores = exam._count.questions > 0 ? exam.attempts.flatMap((attempt) => attempt.score == null ? [] : [{ studentId: attempt.studentId, score: Math.min(maxScore, (attempt.score / exam._count.questions) * maxScore) }]) : [];
  } else if (sourceType === "google_form") {
    const form = await prisma.googleForm.findFirst({ where: { id: sourceId, ownerId: session.user.id }, select: { id: true, gradeColumn: { select: { id: true } } } });
    if (!form) return NextResponse.json({ error: "ไม่พบ Google Form" }, { status: 404 });
    if (form.gradeColumn) return NextResponse.json({ error: "Google Form นี้เชื่อมกับสมุดคะแนนแล้ว" }, { status: 409 });
    googleFormId = form.id;
  } else if (sourceType !== "manual") {
    return NextResponse.json({ error: "แหล่งคะแนนไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const column = await prisma.gradeColumn.create({
      data: {
        ownerId: session.user.id, classId, title, period, maxScore,
        ...(examId ? { examId } : {}), ...(googleFormId ? { googleFormId } : {}),
        ...(importScores.length ? { scores: { create: importScores } } : {}),
      },
    });
    return NextResponse.json(column, { status: 201 });
  } catch (error) {
    console.error("[Gradebook] create column failed", error);
    return NextResponse.json({ error: "สร้างช่องคะแนนไม่สำเร็จ อาจมีการเชื่อมข้อสอบนี้ไว้แล้ว" }, { status: 409 });
  }
}
