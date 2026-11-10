import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || !Object.prototype.hasOwnProperty.call(body, "teachingAssignmentId")) {
    return NextResponse.json({ error: "กรุณาระบุรายวิชาที่ต้องการเชื่อม" }, { status: 400 });
  }
  const rawAssignmentId = body.teachingAssignmentId;
  if (rawAssignmentId !== null && typeof rawAssignmentId !== "string") {
    return NextResponse.json({ error: "รหัสรายวิชาไม่ถูกต้อง" }, { status: 400 });
  }
  const teachingAssignmentId = typeof rawAssignmentId === "string" && rawAssignmentId.trim()
    ? rawAssignmentId.trim()
    : null;

  const column = await prisma.gradeColumn.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, classId: true, assignmentId: true, teachingAssignmentId: true },
  });
  if (!column) return NextResponse.json({ error: "ไม่พบช่องคะแนนหรือไม่มีสิทธิ์" }, { status: 404 });

  const targetTeachingAssignment = teachingAssignmentId
    ? await prisma.teachingAssignment.findFirst({
        where: { id: teachingAssignmentId, ownerId: session.user.id, classId: column.classId },
        select: { id: true, subjectId: true },
      })
    : null;
  if (teachingAssignmentId && !targetTeachingAssignment) {
    return NextResponse.json({ error: "รายวิชาที่เลือกไม่ได้อยู่ในห้องเรียนของช่องคะแนนนี้" }, { status: 400 });
  }

  const linkedAssignment = column.assignmentId
    ? await prisma.assignment.findFirst({
        where: { id: column.assignmentId, ownerId: session.user.id, classId: column.classId },
        select: { id: true, groupId: true },
      })
    : null;
  if (column.assignmentId && !linkedAssignment) {
    return NextResponse.json({ error: "ไม่พบงานมอบหมายที่เชื่อมกับช่องคะแนนนี้ กรุณาตรวจสอบข้อมูลก่อนแก้ไข" }, { status: 409 });
  }
  if (linkedAssignment && !teachingAssignmentId) {
    return NextResponse.json({ error: "งานที่แสดงในหน้ามอบหมายต้องผูกรายวิชาไว้เสมอ" }, { status: 400 });
  }

  if (linkedAssignment?.groupId && targetTeachingAssignment) {
    const groupMembers = await prisma.assignment.findMany({
      where: { groupId: linkedAssignment.groupId, ownerId: session.user.id },
      select: { id: true, teachingAssignment: { select: { subjectId: true } } },
    });
    if (groupMembers.some((member) =>
      member.id !== linkedAssignment.id && member.teachingAssignment.subjectId !== targetTeachingAssignment.subjectId
    )) {
      return NextResponse.json({ error: "งานกลุ่มหลายห้องต้องใช้รายวิชาเดียวกันทุกห้อง" }, { status: 409 });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const savedColumn = await tx.gradeColumn.update({
        where: { id: column.id },
        data: { teachingAssignmentId },
        select: { id: true, teachingAssignmentId: true },
      });

      if (linkedAssignment) {
        const synced = await tx.assignment.updateMany({
          where: { id: linkedAssignment.id, ownerId: session.user.id },
          data: { teachingAssignmentId: teachingAssignmentId! },
        });
        if (synced.count !== 1) throw new Error("LINKED_ASSIGNMENT_NOT_UPDATED");
      }

      return savedColumn;
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Gradebook] update teaching assignment and linked task failed", error);
    return NextResponse.json({ error: "เปลี่ยนรายวิชาในสมุดออนไลน์และหน้ามอบหมายไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const column = await prisma.gradeColumn.findFirst({
    where: { id, ownerId: session.user.id },
    select: {
      id: true,
      assignment: {
        select: {
          id: true,
          groupId: true,
          _count: { select: { submissions: true, files: true } },
        },
      },
    },
  });
  if (!column) return NextResponse.json({ error: "ไม่พบช่องคะแนน" }, { status: 404 });

  if (column.assignment?.groupId) {
    return NextResponse.json({ error: "งานนี้เป็นงานกลุ่มหลายห้อง จึงไม่สามารถลบจากสมุดคะแนนเพียงห้องเดียวได้" }, { status: 409 });
  }
  if (column.assignment && (column.assignment._count.submissions > 0 || column.assignment._count.files > 0)) {
    return NextResponse.json({ error: "งานนี้มีประวัติการส่งหรือไฟล์แนบแล้ว ระบบไม่ลบเพื่อรักษาข้อมูล กรุณาปิดงานแทน" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    if (column.assignment) {
      await tx.assignment.delete({ where: { id: column.assignment.id } });
    }
    await tx.gradeColumn.delete({ where: { id: column.id } });
  });
  return NextResponse.json({ ok: true });
}
