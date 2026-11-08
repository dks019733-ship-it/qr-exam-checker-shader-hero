import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, ensureDatabaseSchema } from "@/lib/prisma";

export async function GET() {
  await ensureDatabaseSchema();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = session.user.id;
  const assignments = await prisma.teachingAssignment.findMany({
    where: { ownerId },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, name: true } },
      _count: { select: { enrollments: true, exams: true, gradeColumns: true } },
    },
    orderBy: [{ subject: { code: "asc" } }, { classroom: { name: "asc" } }],
  });
  return NextResponse.json(assignments);
}

export async function POST(request: Request) {
  await ensureDatabaseSchema();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = session.user.id;
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const requestedClassIds: unknown[] = Array.isArray(body?.classIds)
    ? body.classIds
    : typeof body?.classId === "string" ? [body.classId] : [];
  const hasInvalidClassId = requestedClassIds.some(
    (id) => typeof id !== "string" || !id.trim(),
  );
  const classIds: string[] = Array.from(new Set(
    requestedClassIds.map((id) => typeof id === "string" ? id.trim() : ""),
  ));
  if (
    !code || code.length > 40 ||
    !name || name.length > 120 ||
    !classIds.length || hasInvalidClassId ||
    requestedClassIds.length > 50 || classIds.length > 50
  ) {
    return NextResponse.json({ error: "กรุณาระบุรหัสวิชา ชื่อวิชา และเลือกห้องเรียนอย่างน้อย 1 ห้อง (ไม่เกิน 50 ห้อง)" }, { status: 400 });
  }

  const classrooms = await prisma.class.findMany({
    where: { id: { in: classIds }, ownerId },
    select: { id: true },
  });
  if (classrooms.length !== classIds.length) {
    return NextResponse.json({ error: "มีห้องเรียนที่ไม่พบหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.upsert({
        where: { ownerId_code: { ownerId, code } },
        create: { id: crypto.randomUUID(), ownerId, code, name },
        update: { name },
      });

      // Bulk-create missing class assignments; the compound unique key makes retries idempotent.
      await tx.teachingAssignment.createMany({
        data: classIds.map((classId) => ({
          id: crypto.randomUUID(),
          ownerId,
          subjectId: subject.id,
          classId,
        })),
        skipDuplicates: true,
      });

      const assignments = await tx.teachingAssignment.findMany({
        where: { ownerId, subjectId: subject.id, classId: { in: classIds } },
        select: { id: true, classId: true },
      });
      if (assignments.length !== classIds.length) {
        throw new Error("Unable to resolve all teaching assignments after upsert");
      }

      const assignmentByClassId = new Map(assignments.map((assignment) => [assignment.classId, assignment.id]));
      const activeStudents = await tx.student.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: { id: true, classId: true },
      });
      const enrollments = activeStudents.flatMap((student) => {
        const assignmentId = assignmentByClassId.get(student.classId);
        return assignmentId
          ? [{ id: crypto.randomUUID(), assignmentId, studentId: student.id }]
          : [];
      });

      if (enrollments.length) {
        await tx.courseEnrollment.createMany({
          data: enrollments,
          skipDuplicates: true,
        });
      }

      return { subject, assignments };
    }, { timeout: 10000 });    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[TeachingAssignments] create failed", error);
    return NextResponse.json({ error: "สร้างรายวิชาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
