import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set(["PRESENT", "ABSENT", "LEAVE", "LATE"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export async function GET(request: Request) {
  const unavailable = await featureAvailabilityResponse("attendance");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const teachingAssignmentId = params.get("teachingAssignmentId") || "";
  const date = parseDate(params.get("date"));
  if (!teachingAssignmentId || !date) {
    return NextResponse.json({ error: "กรุณาระบุรายวิชาและวันที่ให้ถูกต้อง" }, { status: 400 });
  }

  const assignment = await prisma.teachingAssignment.findFirst({
    where: { id: teachingAssignmentId, ownerId: session.user.id },
    include: { classroom: { select: { id: true, name: true } }, subject: { select: { code: true, name: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบรายวิชาหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  const [students, attendance] = await Promise.all([
    prisma.student.findMany({
      where: { classId: assignment.classId, isActive: true },
      select: { id: true, rollNo: true, studentNo: true, name: true },
      orderBy: [{ rollNo: "asc" }, { studentNo: "asc" }],
    }),
    prisma.attendanceSession.findUnique({
      where: { teachingAssignmentId_date: { teachingAssignmentId, date } },
      include: { records: { select: { studentId: true, status: true, note: true, markedAt: true } } },
    }),
  ]);

  const recordByStudent = new Map((attendance?.records ?? []).map((record) => [record.studentId, record]));
  return NextResponse.json({
    session: attendance ? { id: attendance.id, date: params.get("date"), topic: attendance.topic } : null,
    classroom: assignment.classroom,
    subject: assignment.subject,
    students: students.map((student) => ({
      ...student,
      attendance: recordByStudent.get(student.id)?.status ?? null,
      note: recordByStudent.get(student.id)?.note ?? "",
      markedAt: recordByStudent.get(student.id)?.markedAt?.toISOString() ?? null,
    })),
  });
}

export async function PUT(request: Request) {
  const unavailable = await featureAvailabilityResponse("attendance");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const teachingAssignmentId = typeof body?.teachingAssignmentId === "string" ? body.teachingAssignmentId : "";
  const date = parseDate(body?.date);
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 240) : "";
  const records = Array.isArray(body?.records) ? body.records : [];
  if (!teachingAssignmentId || !date || records.length > 500) {
    return NextResponse.json({ error: "ข้อมูลการเช็กชื่อไม่ถูกต้อง" }, { status: 400 });
  }

  const normalized = new Map<string, { studentId: string; status: string; note: string }>();
  for (const record of records) {
    if (
      !record || typeof record.studentId !== "string" ||
      typeof record.status !== "string" || !STATUSES.has(record.status)
    ) {
      return NextResponse.json({ error: "พบสถานะหรือรหัสนักเรียนที่ไม่ถูกต้อง" }, { status: 400 });
    }
    normalized.set(record.studentId, {
      studentId: record.studentId,
      status: record.status,
      note: typeof record.note === "string" ? record.note.trim().slice(0, 240) : "",
    });
  }

  const assignment = await prisma.teachingAssignment.findFirst({
    where: { id: teachingAssignmentId, ownerId: session.user.id },
    select: { id: true, ownerId: true, classId: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบรายวิชาหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  const studentIds = [...normalized.keys()];
  const validStudents = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds }, classId: assignment.classId, isActive: true },
        select: { id: true },
      })
    : [];
  if (validStudents.length !== studentIds.length) {
    return NextResponse.json({ error: "มีนักเรียนที่ไม่อยู่ในห้องเรียนนี้หรือไม่มีสถานะใช้งาน" }, { status: 400 });
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendanceSession.upsert({
        where: { teachingAssignmentId_date: { teachingAssignmentId, date } },
        create: {
          ownerId: assignment.ownerId,
          classId: assignment.classId,
          teachingAssignmentId,
          date,
          topic,
        },
        update: { topic },
        select: { id: true, date: true, topic: true },
      });

      for (const record of normalized.values()) {
        await tx.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: attendance.id, studentId: record.studentId } },
          create: {
            sessionId: attendance.id,
            studentId: record.studentId,
            status: record.status as "PRESENT" | "ABSENT" | "LEAVE" | "LATE",
            note: record.note,
          },
          update: {
            status: record.status as "PRESENT" | "ABSENT" | "LEAVE" | "LATE",
            note: record.note,
            markedAt: new Date(),
          },
        });
      }
      return attendance;
    });
    return NextResponse.json({ ok: true, session: saved, savedRecords: normalized.size });
  } catch (error) {
    console.error("[Attendance] save failed:", error);
    return NextResponse.json({ error: "บันทึกการเช็กชื่อไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
