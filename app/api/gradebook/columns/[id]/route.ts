import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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
    select: { id: true, classId: true },
  });
  if (!column) return NextResponse.json({ error: "ไม่พบช่องคะแนนหรือไม่มีสิทธิ์" }, { status: 404 });

  if (teachingAssignmentId) {
    const assignment = await prisma.teachingAssignment.findFirst({
      where: { id: teachingAssignmentId, ownerId: session.user.id, classId: column.classId },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json({ error: "รายวิชาที่เลือกไม่ได้อยู่ในห้องเรียนของช่องคะแนนนี้" }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.gradeColumn.update({
      where: { id: column.id },
      data: { teachingAssignmentId },
      select: { id: true, teachingAssignmentId: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Gradebook] update teaching assignment failed", error);
    return NextResponse.json({ error: "เปลี่ยนรายวิชาของช่องคะแนนไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await prisma.gradeColumn.deleteMany({ where: { id, ownerId: session.user.id } });
  if (!result.count) return NextResponse.json({ error: "ไม่พบช่องคะแนน" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
