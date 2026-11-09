import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MODES = new Set(["TEACHER_CHECK", "SYSTEM_UPLOAD", "GOOGLE_FORM"]);

function isAllowedGoogleFormUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "forms.gle" || url.hostname === "docs.google.com") &&
      (url.hostname !== "docs.google.com" || url.pathname.startsWith("/forms/"));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const classId = new URL(request.url).searchParams.get("classId");
  const assignments = await prisma.assignment.findMany({
    where: { ownerId: session.user.id, ...(classId ? { classId } : {}) },
    include: {
      classroom: { select: { id: true, name: true } },
      teachingAssignment: { include: { subject: { select: { code: true, name: true } } } },
      files: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
      gradeColumn: { select: { id: true, title: true, period: true, maxScore: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return NextResponse.json(assignments);
}

export async function POST(request: Request) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const teachingAssignmentId = typeof body?.teachingAssignmentId === "string" ? body.teachingAssignmentId : "";
  const gradeColumnId = typeof body?.gradeColumnId === "string" ? body.gradeColumnId : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const status = body?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const googleFormUrl = typeof body?.googleFormUrl === "string" ? body.googleFormUrl.trim() : "";
  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
  const autoMarkAttendance = body?.autoMarkAttendance === true;
  const attendanceSessionId = typeof body?.attendanceSessionId === "string" ? body.attendanceSessionId : null;

  if (!teachingAssignmentId || !gradeColumnId || description.length > 5000 || !MODES.has(mode)) {
    return NextResponse.json({ error: "กรุณาเลือกรายวิชา ช่องคะแนน และตรวจสอบรูปแบบงาน" }, { status: 400 });
  }
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "กำหนดส่งไม่ถูกต้อง" }, { status: 400 });
  }
  if (status === "PUBLISHED" && mode === "SYSTEM_UPLOAD") {
    return NextResponse.json(
      { error: "งานแบบส่งไฟล์ต้องสร้างเป็นฉบับร่าง แนบไฟล์คำสั่งงาน แล้วจึงเผยแพร่" },
      { status: 400 },
    );
  }
  if (mode === "GOOGLE_FORM" && !isAllowedGoogleFormUrl(googleFormUrl)) {
    return NextResponse.json({ error: "ลิงก์ต้องเป็น Google Forms ที่ปลอดภัย (forms.gle หรือ docs.google.com/forms)" }, { status: 400 });
  }
  if (mode !== "GOOGLE_FORM" && googleFormUrl) {
    return NextResponse.json({ error: "รูปแบบงานนี้ไม่รองรับลิงก์ Google Forms" }, { status: 400 });
  }

  const teachingAssignment = await prisma.teachingAssignment.findFirst({
    where: { id: teachingAssignmentId, ownerId: session.user.id },
    select: { id: true, ownerId: true, classId: true },
  });
  if (!teachingAssignment) return NextResponse.json({ error: "ไม่พบรายวิชาหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  const gradeColumn = await prisma.gradeColumn.findFirst({
    where: {
      id: gradeColumnId,
      ownerId: session.user.id,
      classId: teachingAssignment.classId,
      OR: [{ teachingAssignmentId }, { teachingAssignmentId: null }],
      assignmentId: null,
    },
    select: { id: true, title: true, maxScore: true },
  });
  if (!gradeColumn) {
    return NextResponse.json({ error: "ไม่พบช่องคะแนนที่ยังไม่ถูกเชื่อมในรายวิชาและห้องเรียนนี้ กรุณาโหลดรายการใหม่" }, { status: 409 });
  }

  if (attendanceSessionId) {
    const attendance = await prisma.attendanceSession.findFirst({
      where: {
        id: attendanceSessionId,
        ownerId: session.user.id,
        teachingAssignmentId,
        classId: teachingAssignment.classId,
      },
      select: { id: true },
    });
    if (!attendance) return NextResponse.json({ error: "ไม่พบคาบเรียนที่เลือก" }, { status: 404 });
  }
  if (autoMarkAttendance && mode !== "SYSTEM_UPLOAD") {
    return NextResponse.json({ error: "การเช็กชื่ออัตโนมัติรองรับเฉพาะงานแบบส่งไฟล์ในระบบ" }, { status: 400 });
  }
  if (autoMarkAttendance && !attendanceSessionId) {
    return NextResponse.json({ error: "ต้องเลือกคาบเช็กชื่อก่อนเปิดใช้การเช็กชื่ออัตโนมัติ" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          ownerId: teachingAssignment.ownerId,
          classId: teachingAssignment.classId,
          teachingAssignmentId,
          attendanceSessionId,
          title: gradeColumn.title,
          description,
          mode: mode as "TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM",
          status,
          googleFormUrl: mode === "GOOGLE_FORM" ? googleFormUrl : null,
          dueAt,
          maxScore: gradeColumn.maxScore,
          autoMarkAttendance,
        },
        select: { id: true, title: true, mode: true, status: true, classId: true, dueAt: true, createdAt: true },
      });

      const linked = await tx.gradeColumn.updateMany({
        where: {
          id: gradeColumn.id,
          ownerId: session.user.id,
          classId: teachingAssignment.classId,
          OR: [{ teachingAssignmentId }, { teachingAssignmentId: null }],
          assignmentId: null,
        },
        data: { assignmentId: assignment.id, teachingAssignmentId },
      });
      if (linked.count !== 1) throw new Error("GRADE_COLUMN_LINK_CONFLICT");

      return {
        ...assignment,
        gradeColumn: { id: gradeColumn.id, title: gradeColumn.title, maxScore: gradeColumn.maxScore },
      };
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[Assignments] create failed:", error);
    return NextResponse.json({ error: "สร้างงานไม่สำเร็จ ช่องคะแนนอาจถูกเชื่อมกับงานอื่นแล้ว กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
  }
}
