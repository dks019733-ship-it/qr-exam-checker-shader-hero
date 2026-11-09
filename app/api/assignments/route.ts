import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MODES = new Set(["TEACHER_CHECK", "SYSTEM_UPLOAD", "GOOGLE_FORM"]);
const GRADE_PERIODS = new Set(["MIDTERM", "AFTER_MIDTERM"]);

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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const status = body?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const googleFormUrl = typeof body?.googleFormUrl === "string" ? body.googleFormUrl.trim() : "";
  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
  const maxScore = body?.maxScore === null || body?.maxScore === undefined || body?.maxScore === ""
    ? null : Number(body.maxScore);
  const gradePeriod = typeof body?.gradePeriod === "string" ? body.gradePeriod : "";
  const autoMarkAttendance = body?.autoMarkAttendance === true;
  const attendanceSessionId = typeof body?.attendanceSessionId === "string" ? body.attendanceSessionId : null;

  if (!teachingAssignmentId || !title || title.length > 160 || description.length > 5000 || !MODES.has(mode)) {
    return NextResponse.json({ error: "กรุณาตรวจสอบชื่อ รายละเอียด และรูปแบบงาน" }, { status: 400 });
  }
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "กำหนดส่งไม่ถูกต้อง" }, { status: 400 });
  }
  if (maxScore === null || !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 10000) {
    return NextResponse.json({ error: "กรุณากำหนดคะแนนเต็มมากกว่า 0 เพื่อเชื่อมกับสมุดคะแนน" }, { status: 400 });
  }
  if (!GRADE_PERIODS.has(gradePeriod)) {
    return NextResponse.json({ error: "กรุณาเลือกภาคเรียนของคะแนนงาน" }, { status: 400 });
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
    const created = await prisma.assignment.create({
      data: {
        ownerId: teachingAssignment.ownerId,
        classId: teachingAssignment.classId,
        teachingAssignmentId,
        attendanceSessionId,
        title,
        description,
        mode: mode as "TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM",
        status,
        googleFormUrl: mode === "GOOGLE_FORM" ? googleFormUrl : null,
        dueAt,
        maxScore,
        autoMarkAttendance,
        gradeColumn: {
          create: {
            ownerId: teachingAssignment.ownerId,
            classId: teachingAssignment.classId,
            title,
            period: gradePeriod as "MIDTERM" | "AFTER_MIDTERM",
            maxScore,
            teachingAssignmentId,
          },
        },
      },
      select: { id: true, title: true, mode: true, status: true, classId: true, dueAt: true, createdAt: true, gradeColumn: { select: { id: true, period: true, maxScore: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[Assignments] create failed:", error);
    return NextResponse.json({ error: "สร้างงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
