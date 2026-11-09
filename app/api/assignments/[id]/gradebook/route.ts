import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const periods = ["MIDTERM", "AFTER_MIDTERM"] as const;

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
  const period = body?.period;
  const rawMaxScore = body?.maxScore;
  const maxScore = typeof rawMaxScore === "number" || (typeof rawMaxScore === "string" && rawMaxScore.trim())
    ? Number(rawMaxScore)
    : Number.NaN;

  if (!periods.includes(period) || !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 10000) {
    return NextResponse.json({ error: "กรุณาเลือกภาคเรียนและคะแนนเต็มมากกว่า 0" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: {
      id: true,
      ownerId: true,
      classId: true,
      teachingAssignmentId: true,
      title: true,
      gradeColumn: { select: { id: true } },
    },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  if (assignment.gradeColumn) return NextResponse.json({ error: "งานนี้เชื่อมกับสมุดคะแนนอยู่แล้ว" }, { status: 409 });

  try {
    const column = await prisma.gradeColumn.create({
      data: {
        ownerId: assignment.ownerId,
        classId: assignment.classId,
        title: assignment.title,
        period,
        maxScore,
        teachingAssignmentId: assignment.teachingAssignmentId,
        assignmentId: assignment.id,
      },
      select: { id: true, period: true, maxScore: true },
    });
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { maxScore },
    });
    return NextResponse.json(column, { status: 201 });
  } catch (error) {
    console.error("[Assignments] link gradebook failed:", error);
    return NextResponse.json({ error: "เชื่อมงานกับสมุดคะแนนไม่สำเร็จ อาจมีการเชื่อมพร้อมกัน กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
  }
}
