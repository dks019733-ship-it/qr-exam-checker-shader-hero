import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";

function getBangkokDateOnly() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

async function getAuthenticatedStudentId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("student_token")?.value;
  if (!token) return null;

  const payload = verifyStudentToken(token);
  if (!payload?.studentId) return null;

  const student = await prisma.student.findUnique({
    where: { id: payload.studentId, isActive: true },
    select: { id: true },
  });
  return student?.id ?? null;
}

export async function GET() {
  try {
    const studentId = await getAuthenticatedStudentId();
    if (!studentId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const dismissedOn = getBangkokDateOnly();
    const dismissal = await prisma.studentWelcomeDismissal.findUnique({
      where: { studentId_dismissedOn: { studentId, dismissedOn } },
      select: { id: true },
    });

    return NextResponse.json({ dismissed: Boolean(dismissal) });
  } catch (error) {
    console.error("[StudentWelcomeDismissal] GET error:", error);
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบสถานะข้อความต้อนรับได้" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const studentId = await getAuthenticatedStudentId();
    if (!studentId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const dismissedOn = getBangkokDateOnly();
    await prisma.studentWelcomeDismissal.upsert({
      where: { studentId_dismissedOn: { studentId, dismissedOn } },
      create: { studentId, dismissedOn },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[StudentWelcomeDismissal] POST error:", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึกสถานะข้อความต้อนรับได้" }, { status: 500 });
  }
}
