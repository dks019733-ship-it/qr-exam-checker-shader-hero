import crypto from "crypto";
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
  const ownerId = session.user.id;

  const classId = new URL(request.url).searchParams.get("classId");
  const assignments = await prisma.assignment.findMany({
    where: { ownerId: ownerId, ...(classId ? { classId } : {}) },
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
  const ownerId = session.user.id;

  const body = await request.json().catch(() => null);
  const teachingAssignmentId = typeof body?.teachingAssignmentId === "string" ? body.teachingAssignmentId : "";
  const gradeColumnId = typeof body?.gradeColumnId === "string" ? body.gradeColumnId : "";
  const rawTargetIds: unknown[] = Array.isArray(body?.targetTeachingAssignmentIds)
    ? body.targetTeachingAssignmentIds
    : [teachingAssignmentId];
  const invalidTarget = rawTargetIds.some((id) => typeof id !== "string" || !id.trim());
  const targetIds = Array.from(new Set(rawTargetIds.map((id) => typeof id === "string" ? id.trim() : "")));
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const status = body?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const googleFormUrl = typeof body?.googleFormUrl === "string" ? body.googleFormUrl.trim() : "";
  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
  const autoMarkAttendance = body?.autoMarkAttendance === true;
  const attendanceSessionId = typeof body?.attendanceSessionId === "string" ? body.attendanceSessionId : null;
  const attendanceDate = typeof body?.attendanceDate === "string" ? body.attendanceDate : "";

  if (
    !teachingAssignmentId || !gradeColumnId || invalidTarget || !targetIds.length ||
    targetIds.length > 30 || !targetIds.includes(teachingAssignmentId) ||
    description.length > 5000 || !MODES.has(mode)
  ) {
    return NextResponse.json({ error: "กรุณาเลือกรายวิชา ช่องคะแนน และห้องเรียนที่ต้องการมอบหมายให้ถูกต้อง" }, { status: 400 });
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

  const teachingAssignments = await prisma.teachingAssignment.findMany({
    where: { id: { in: targetIds }, ownerId },
    select: { id: true, ownerId: true, classId: true },
  });
  if (teachingAssignments.length !== targetIds.length) {
    return NextResponse.json({ error: "มีรายวิชาหรือห้องเรียนที่ไม่พบหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  }
  if (new Set(teachingAssignments.map((item) => item.classId)).size !== teachingAssignments.length) {
    return NextResponse.json({ error: "เลือกได้เพียงหนึ่งรายวิชาต่อหนึ่งห้องเรียนในงานชุดเดียวกัน" }, { status: 400 });
  }
  const primaryTeachingAssignment = teachingAssignments.find((item) => item.id === teachingAssignmentId);
  if (!primaryTeachingAssignment) {
    return NextResponse.json({ error: "ไม่พบรายวิชาหลักที่เลือก" }, { status: 404 });
  }

  const primaryGradeColumn = await prisma.gradeColumn.findFirst({
    where: {
      id: gradeColumnId,
      ownerId,
      classId: primaryTeachingAssignment.classId,
      OR: [{ teachingAssignmentId }, { teachingAssignmentId: null }],
      assignmentId: null,
    },
    select: { id: true, title: true, period: true, maxScore: true },
  });
  if (!primaryGradeColumn) {
    return NextResponse.json({ error: "ไม่พบช่องคะแนนที่ยังไม่ถูกเชื่อมในรายวิชาและห้องเรียนนี้ กรุณาโหลดรายการใหม่" }, { status: 409 });
  }

  const targets: { teachingAssignmentId: string; classId: string; attendanceSessionId: string | null; gradeColumn: typeof primaryGradeColumn }[] = [];
  for (const target of teachingAssignments) {
    let targetColumn = primaryGradeColumn;
    if (target.id !== teachingAssignmentId) {
      const candidates = await prisma.gradeColumn.findMany({
        where: {
          ownerId,
          classId: target.classId,
          title: primaryGradeColumn.title,
          period: primaryGradeColumn.period,
          maxScore: primaryGradeColumn.maxScore,
          assignmentId: null,
          OR: [{ teachingAssignmentId: target.id }, { teachingAssignmentId: null }],
        },
        select: { id: true, title: true, period: true, maxScore: true },
      });
      if (candidates.length !== 1) {
        const reason = candidates.length === 0 ? "ยังไม่มีช่องคะแนนที่ตรงกัน" : "พบช่องคะแนนชื่อซ้ำ";
        return NextResponse.json({
          error: `ห้องเรียนเป้าหมาย ${target.classId} ${reason} กรุณาสร้างหรือจัดการช่องคะแนนให้มีชื่อ ช่วงคะแนน และคะแนนเต็มตรงกันก่อน`,
        }, { status: 409 });
      }
      targetColumn = candidates[0];
    }
    targets.push({ teachingAssignmentId: target.id, classId: target.classId, attendanceSessionId: null, gradeColumn: targetColumn });
  }

  if (autoMarkAttendance && mode !== "SYSTEM_UPLOAD") {
    return NextResponse.json({ error: "การเช็กชื่ออัตโนมัติรองรับเฉพาะงานแบบส่งไฟล์ในระบบ" }, { status: 400 });
  }
  if (autoMarkAttendance) {
    if (attendanceDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) || Number.isNaN(new Date(`${attendanceDate}T00:00:00.000Z`).getTime())) {
        return NextResponse.json({ error: "วันที่ของคาบเช็กชื่อไม่ถูกต้อง" }, { status: 400 });
      }
      const sessions = await prisma.attendanceSession.findMany({
        where: {
          ownerId,
          teachingAssignmentId: { in: targetIds },
          date: new Date(`${attendanceDate}T00:00:00.000Z`),
        },
        select: { id: true, teachingAssignmentId: true },
      });
      const sessionByTeachingAssignment = new Map(sessions.map((item) => [item.teachingAssignmentId, item.id]));
      for (const target of targets) {
        const resolved = sessionByTeachingAssignment.get(target.teachingAssignmentId);
        if (!resolved) {
          return NextResponse.json({ error: `ยังไม่มีคาบเช็กชื่อของวันที่เลือกในห้อง ${target.classId} กรุณาบันทึกคาบก่อน` }, { status: 409 });
        }
        target.attendanceSessionId = resolved;
      }
    } else if (targetIds.length === 1 && attendanceSessionId) {
      const attendance = await prisma.attendanceSession.findFirst({
        where: {
          id: attendanceSessionId,
          ownerId,
          teachingAssignmentId,
          classId: primaryTeachingAssignment.classId,
        },
        select: { id: true },
      });
      if (!attendance) return NextResponse.json({ error: "ไม่พบคาบเรียนที่เลือก" }, { status: 404 });
      targets[0].attendanceSessionId = attendance.id;
    } else {
      return NextResponse.json({ error: "ต้องเลือกวันที่และมีคาบเช็กชื่อครบทุกห้องก่อนเปิดใช้การเช็กชื่ออัตโนมัติ" }, { status: 400 });
    }
  }

  const groupId = crypto.randomUUID();
  try {
    const createdAssignments = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const target of targets) {
        const assignment = await tx.assignment.create({
          data: {
            ownerId,
            classId: target.classId,
            teachingAssignmentId: target.teachingAssignmentId,
            groupId,
            attendanceSessionId: target.attendanceSessionId,
            title: target.gradeColumn.title,
            description,
            mode: mode as "TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM",
            status,
            googleFormUrl: mode === "GOOGLE_FORM" ? googleFormUrl : null,
            dueAt,
            maxScore: target.gradeColumn.maxScore,
            autoMarkAttendance,
          },
          select: { id: true, title: true, mode: true, status: true, classId: true, dueAt: true, createdAt: true, groupId: true },
        });

        const linked = await tx.gradeColumn.updateMany({
          where: {
            id: target.gradeColumn.id,
            ownerId,
            classId: target.classId,
            OR: [{ teachingAssignmentId: target.teachingAssignmentId }, { teachingAssignmentId: null }],
            assignmentId: null,
          },
          data: { assignmentId: assignment.id, teachingAssignmentId: target.teachingAssignmentId },
        });
        if (linked.count !== 1) throw new Error("GRADE_COLUMN_LINK_CONFLICT");
        created.push({
          ...assignment,
          gradeColumn: { id: target.gradeColumn.id, title: target.gradeColumn.title, maxScore: target.gradeColumn.maxScore },
        });
      }
      return created;
    }, { timeout: 15000 });

    return NextResponse.json({
      ...createdAssignments[0],
      groupId,
      assignments: createdAssignments,
    }, { status: 201 });
  } catch (error) {
    console.error("[Assignments] create group failed:", error);
    return NextResponse.json({ error: "สร้างงานไม่สำเร็จ ช่องคะแนนบางห้องอาจถูกเชื่อมกับงานอื่นแล้ว กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const status = body?.status;
  if (!groupId || !["PUBLISHED", "CLOSED", "DRAFT"].includes(status)) {
    return NextResponse.json({ error: "ข้อมูลกลุ่มงานหรือสถานะไม่ถูกต้อง" }, { status: 400 });
  }

  const group = await prisma.assignment.findMany({
    where: { groupId, ownerId: session.user.id },
    include: { _count: { select: { files: true } } },
  });
  if (!group.length) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });

  if (status === "PUBLISHED") {
    const invalid = group.find((assignment) =>
      (assignment.mode === "GOOGLE_FORM" && !assignment.googleFormUrl) ||
      (assignment.mode === "SYSTEM_UPLOAD" && assignment._count.files === 0)
    );
    if (invalid) {
      return NextResponse.json({ error: `งานในห้อง ${invalid.classId} ยังตั้งค่าไม่ครบ จึงเผยแพร่ทั้งชุดไม่ได้` }, { status: 400 });
    }
  }

  const updated = await prisma.assignment.updateMany({
    where: { groupId, ownerId: session.user.id },
    data: { status },
  });
  return NextResponse.json({ ok: true, groupId, updatedCount: updated.count });
}
