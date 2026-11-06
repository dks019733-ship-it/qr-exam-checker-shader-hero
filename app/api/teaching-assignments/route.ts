import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = session.user.id;
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const classId = typeof body?.classId === "string" ? body.classId : "";
  if (!code || code.length > 40 || !name || name.length > 120 || !classId) {
    return NextResponse.json({ error: "กรุณาระบุรหัสวิชา ชื่อวิชา และห้องเรียนให้ถูกต้อง" }, { status: 400 });
  }

  const classroom = await prisma.class.findFirst({
    where: { id: classId, ownerId },
    select: { id: true },
  });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.upsert({
        where: { ownerId_code: { ownerId, code } },
        create: { ownerId, code, name },
        update: { name },
      });
      const teachingAssignment = await tx.teachingAssignment.upsert({
        where: { subjectId_classId: { subjectId: subject.id, classId } },
        create: { ownerId, subjectId: subject.id, classId },
        update: {},
        include: {
          subject: { select: { id: true, code: true, name: true } },
          classroom: { select: { id: true, name: true } },
        },
      });
      const students = await tx.student.findMany({
        where: { classId, isActive: true },
        select: { id: true },
      });
      if (students.length) {
        await tx.courseEnrollment.createMany({
          data: students.map((student) => ({ assignmentId: teachingAssignment.id, studentId: student.id })),
          skipDuplicates: true,
        });
      }
      return teachingAssignment;
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error("[TeachingAssignments] create failed", error);
    return NextResponse.json({ error: "สร้างรายวิชาไม่สำเร็จ" }, { status: 500 });
  }
}
