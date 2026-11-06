import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, ensureDatabaseSchema } from "@/lib/prisma";
import { bulkStudentSchema } from "@/lib/answer-sheet";
import { reconcilePendingFormScores } from "@/lib/gradebook-import";

export async function POST(request: Request) {
  await ensureDatabaseSchema();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bulkStudentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลนักเรียนไม่ถูกต้อง" }, { status: 400 });

  const classroom = await prisma.class.findFirst({
    where: { id: parsed.data.classId, ownerId: session.user.id },
    select: { id: true },
  });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  const classroomName = await prisma.class.findUnique({ where: { id: parsed.data.classId }, select: { name: true } }).then((item) => item?.name || "");
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

  const [assignments, teacher] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { ownerId: session.user.id, classId: parsed.data.classId },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { schoolKey: true } }),
  ]);

  const schoolKey = teacher?.schoolKey || session.user.id;

  // Execute student upserts, identity linking, and course enrollment in a single atomic transaction
  await prisma.$transaction(async (tx) => {
    const savedStudents: { id: string; studentNo: string; name: string }[] = [];

    for (const row of normalized) {
      const existing = byStudentCode.get(row.studentNo) || legacyByRollNo.get(row.rollNo);
      let student: { id: string; studentNo: string; name: string };
      if (existing) {
        student = await tx.student.update({
          where: { id: existing.id },
          data: { rollNo: row.rollNo, studentNo: row.studentNo, name: row.name, isActive: true },
          select: { id: true, studentNo: true, name: true },
        });
      } else {
        student = await tx.student.upsert({
          where: { classId_studentNo: { classId: row.classId, studentNo: row.studentNo } },
          create: row,
          update: { rollNo: row.rollNo, name: row.name, isActive: true },
          select: { id: true, studentNo: true, name: true },
        });
      }

      const identity = await tx.studentIdentity.upsert({
        where: {
          schoolKey_className_studentNo: {
            schoolKey,
            className: classroomName,
            studentNo: student.studentNo,
          },
        },
        create: {
          id: crypto.randomUUID(),
          schoolKey,
          className: classroomName,
          studentNo: student.studentNo,
          name: student.name,
        },
        update: { name: student.name },
        select: { id: true },
      });

      await tx.student.update({
        where: { id: student.id },
        data: { identityId: identity.id },
      });

      savedStudents.push(student);
    }

    if (assignments.length && savedStudents.length) {
      await tx.courseEnrollment.createMany({
        data: assignments.flatMap((assignment) =>
          savedStudents.map((student) => ({
            id: crypto.randomUUID(),
            assignmentId: assignment.id,
            studentId: student.id,
          }))
        ),
        skipDuplicates: true,
      });
    }
  });

  const reconciled = await reconcilePendingFormScores(parsed.data.classId);
  return NextResponse.json({ ok: true, count: normalized.length, matchedFormScores: reconciled.matched, pendingFormScores: reconciled.pending });
}
