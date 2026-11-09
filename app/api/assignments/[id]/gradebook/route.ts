import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const gradeColumnId = typeof body?.gradeColumnId === "string" ? body.gradeColumnId : "";
  if (!gradeColumnId) {
    return NextResponse.json({ error: "กรุณาเลือกช่องคะแนนที่มีอยู่ในสมุดออนไลน์" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: {
      id: true,
      ownerId: true,
      classId: true,
      teachingAssignmentId: true,
      gradeColumn: { select: { id: true } },
    },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  const target = await prisma.gradeColumn.findFirst({
    where: {
      id: gradeColumnId,
      ownerId: session.user.id,
      classId: assignment.classId,
      OR: [
        { teachingAssignmentId: assignment.teachingAssignmentId },
        { teachingAssignmentId: null },
      ],
      AND: [{ OR: [{ assignmentId: null }, { assignmentId: assignment.id }] }],
    },
    select: { id: true, title: true, period: true, maxScore: true },
  });
  if (!target) {
    return NextResponse.json({ error: "ช่องคะแนนนี้ไม่ว่างหรือไม่ตรงกับรายวิชาและห้องเรียนของงาน" }, { status: 409 });
  }

  try {
    const linked = await prisma.$transaction(async (tx) => {
      if (assignment.gradeColumn && assignment.gradeColumn.id !== target.id) {
        await tx.gradeColumn.updateMany({
          where: { id: assignment.gradeColumn.id, ownerId: assignment.ownerId, assignmentId: assignment.id },
          data: { assignmentId: null },
        });
      }

      const result = await tx.gradeColumn.updateMany({
        where: {
          id: target.id,
          ownerId: assignment.ownerId,
          classId: assignment.classId,
          OR: [
            { teachingAssignmentId: assignment.teachingAssignmentId },
            { teachingAssignmentId: null },
          ],
          AND: [{ OR: [{ assignmentId: null }, { assignmentId: assignment.id }] }],
        },
        data: { assignmentId: assignment.id, teachingAssignmentId: assignment.teachingAssignmentId },
      });
      if (result.count !== 1) throw new Error("GRADE_COLUMN_LINK_CONFLICT");

      await tx.assignment.update({
        where: { id: assignment.id },
        data: { title: target.title, maxScore: target.maxScore },
      });

      return target;
    });

    return NextResponse.json({
      id: linked.id,
      title: linked.title,
      period: linked.period,
      maxScore: linked.maxScore,
    });
  } catch (error) {
    console.error("[Assignments] link existing gradebook column failed:", error);
    return NextResponse.json({ error: "เชื่อมช่องคะแนนไม่สำเร็จ กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
  }
}
