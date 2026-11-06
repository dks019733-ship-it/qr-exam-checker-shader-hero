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
  const classIds: string[] = Array.from(new Set(
    requestedClassIds.filter((id): id is string => typeof id === "string" && id.length > 0),
  ));
  if (!code || code.length > 40 || !name || name.length > 120 || !classIds.length || requestedClassIds.length > 50 || classIds.length > 50) {
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
      const results = [];
      for (const classId of classIds) {
        const assignment = await tx.teachingAssignment.upsert({
          where: { subjectId_classId: { subjectId: subject.id, classId } },
          create: { id: crypto.randomUUID(), ownerId, subjectId: subject.id, classId },
          update: {},
        });
        const students = await tx.student.findMany({
          where: { classId, isActive: true },
          select: { id: true },
        });
        if (students.length) {
          await tx.courseEnrollment.createMany({
            data: students.map((student) => ({
              id: crypto.randomUUID(),
              assignmentId: assignment.id,
              studentId: student.id,
            })),
            skipDuplicates: true,
          });
        }
        results.push(assignment);
      }
      return { subject, assignments: results };
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[TeachingAssignments] create failed", error);
    return NextResponse.json({ error: "สร้างรายวิชาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
