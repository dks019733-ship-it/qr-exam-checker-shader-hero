import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const unavailable = await featureAvailabilityResponse("attendance");
  if (unavailable) return unavailable;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const teachingAssignmentId = new URL(request.url).searchParams.get("teachingAssignmentId") || "";
  if (!teachingAssignmentId) return NextResponse.json({ error: "กรุณาระบุรายวิชา" }, { status: 400 });
  const assignment = await prisma.teachingAssignment.findFirst({
    where: { id: teachingAssignmentId, ownerId: session.user.id }, select: { id: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบรายวิชาหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  const sessions = await prisma.attendanceSession.findMany({
    where: { ownerId: session.user.id, teachingAssignmentId },
    select: { id: true, date: true, period: true, topic: true, records: { select: { status: true } } },
    orderBy: [{ date: "desc" }, { period: "desc" }], take: 100,
  });
  return NextResponse.json({ sessions: sessions.map((item) => ({
    id: item.id, date: item.date.toISOString().slice(0, 10), period: item.period, topic: item.topic,
    total: item.records.length,
    present: item.records.filter((record) => record.status === "PRESENT").length,
    absent: item.records.filter((record) => record.status === "ABSENT").length,
    leave: item.records.filter((record) => record.status === "LEAVE").length,
    late: item.records.filter((record) => record.status === "LATE").length,
  })) });
}
