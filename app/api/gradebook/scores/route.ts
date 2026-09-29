import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const columnId = typeof body?.columnId === "string" ? body.columnId : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const score = body?.score === null || body?.score === "" ? null : Number(body?.score);
  if (!columnId || !studentId || (score !== null && !Number.isFinite(score))) return NextResponse.json({ error: "คะแนนไม่ถูกต้อง" }, { status: 400 });
  const column = await prisma.gradeColumn.findFirst({ where: { id: columnId, ownerId: session.user.id }, select: { id: true, classId: true, maxScore: true } });
  if (!column) return NextResponse.json({ error: "ไม่พบช่องคะแนน" }, { status: 404 });
  if (score !== null && score > column.maxScore) return NextResponse.json({ error: `คะแนนต้องไม่เกิน ${column.maxScore}` }, { status: 400 });
  const student = await prisma.student.findFirst({ where: { id: studentId, classId: column.classId, isActive: true }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "นักเรียนไม่ได้อยู่ในห้องนี้" }, { status: 400 });
  if (score === null) {
    await prisma.gradeScore.deleteMany({ where: { columnId, studentId } });
    return NextResponse.json({ ok: true, score: null });
  }
  const saved = await prisma.gradeScore.upsert({ where: { columnId_studentId: { columnId, studentId } }, create: { columnId, studentId, score }, update: { score } });
  return NextResponse.json(saved);
}
