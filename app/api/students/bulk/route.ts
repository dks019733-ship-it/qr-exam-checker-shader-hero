import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bulkStudentSchema } from "@/lib/answer-sheet";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bulkStudentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลนักเรียนไม่ถูกต้อง" }, { status: 400 });

  const classroom = await prisma.class.findFirst({
    where: { id: parsed.data.classId, ownerId: session.user.id },
    select: { id: true },
  });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  const normalized = parsed.data.rows.map((row) => ({
    ...row,
    rollNo: row.rollNo.trim(),
    studentNo: row.studentNo.trim(),
    name: row.name.trim(),
    classId: parsed.data.classId,
  }));

  const duplicate = normalized.some((row, i) => normalized.findIndex((x) => x.studentNo === row.studentNo) !== i);
  if (duplicate) return NextResponse.json({ error: "มีรหัสนักเรียนซ้ำในข้อมูลที่ส่งมา" }, { status: 400 });
  const duplicateRollNo = normalized.some((row, i) => normalized.findIndex((x) => x.rollNo === row.rollNo) !== i);
  if (duplicateRollNo) return NextResponse.json({ error: "มีเลขที่ซ้ำในห้องนี้" }, { status: 400 });

  const studentCodes = normalized.map((row) => row.studentNo);
  const oldRollNos = normalized.map((row) => row.rollNo);
  const existingStudents = await prisma.student.findMany({
    where: {
      classId: parsed.data.classId,
      OR: [
        { studentNo: { in: studentCodes } },
        { studentNo: { in: oldRollNos }, rollNo: "" },
      ],
    },
    select: { id: true, studentNo: true, rollNo: true },
  });
  const byStudentCode = new Map(existingStudents.map((student) => [student.studentNo, student]));
  // Repair records from earlier imports that stored the roll number as the student code.
  const legacyByRollNo = new Map(existingStudents.filter((student) => !student.rollNo).map((student) => [student.studentNo, student]));
  const operations = normalized.map((row) => {
    const existing = byStudentCode.get(row.studentNo) || legacyByRollNo.get(row.rollNo);
    if (existing) {
      return prisma.student.update({
        where: { id: existing.id },
        data: { rollNo: row.rollNo, studentNo: row.studentNo, name: row.name, isActive: true },
      });
    }
    return prisma.student.upsert({
      where: { classId_studentNo: { classId: row.classId, studentNo: row.studentNo } },
      create: row,
      update: { rollNo: row.rollNo, name: row.name, isActive: true },
    });
  });
  await prisma.$transaction(operations);

  return NextResponse.json({ ok: true, count: normalized.length });
}
