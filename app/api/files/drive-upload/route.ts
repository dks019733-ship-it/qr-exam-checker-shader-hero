import { featureAvailabilityResponse, getFeatureAvailability } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import { getUploadPolicy, sanitizeUploadName, validateUploadInput } from "@/lib/object-storage";
import { deleteDriveFile, ensureTeacherSubmissionFolder, uploadSubmissionToDrive, verifyUploadBytes } from "@/lib/google-drive-storage";

export const runtime = "nodejs";

const EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

function folderLabels(className: string) {
  const normalized = className.trim();
  const slash = normalized.match(/^(.+?)\s*[/|]\s*(.+)$/);
  if (slash) {
    const room = slash[2].replace(/^ห้อง\s*/i, "").trim();
    return { gradeLevel: slash[1].trim(), roomName: "ห้อง " + room };
  }
  const room = normalized.match(/^(.+?)\s+ห้อง\s*(.+)$/i);
  if (room) return { gradeLevel: room[1].trim(), roomName: "ห้อง " + room[2].trim() };
  return { gradeLevel: normalized, roomName: "ห้องทั่วไป" };
}

function driveError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "GOOGLE_DRIVE_ACCOUNT_NOT_CONNECTED" || code === "GOOGLE_DRIVE_SCOPE_MISSING" || code === "GOOGLE_DRIVE_REAUTH_REQUIRED") {
    return NextResponse.json({ error: "บัญชี Google ของครูยังไม่ได้อนุญาต Google Drive กรุณาออกจากระบบแล้วเข้าสู่ระบบ Google ใหม่เพื่อให้สิทธิ์ Drive" }, { status: 409 });
  }
  if (code === "GOOGLE_OAUTH_NOT_CONFIGURED") {
    return NextResponse.json({ error: "ระบบเชื่อมต่อ Google Drive ยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  return null;
}

export async function POST(request: Request) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const form = await request.formData().catch(() => null);
  const assignmentId = typeof form?.get("assignmentId") === "string" ? String(form.get("assignmentId")) : "";
  const file = form?.get("file");
  if (!assignmentId || !(file instanceof File)) {
    return NextResponse.json({ error: "ข้อมูลไฟล์ส่งงานไม่ถูกต้อง" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("student_token")?.value;
  const payload = token ? verifyStudentToken(token) : null;
  if (!payload?.studentId || !payload.classId) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบนักเรียน" }, { status: 401 });
  }

  const fileName = sanitizeUploadName(file.name);
  const contentType = file.type.toLowerCase();
  const sizeBytes = file.size;
  const validationError = validateUploadInput(contentType, sizeBytes);
  const extensionMatches = (EXTENSIONS[contentType] || []).some((ext) => fileName.toLowerCase().endsWith(ext));
  if (validationError || !extensionMatches) {
    return NextResponse.json({ error: validationError || "ชื่อไฟล์หรือนามสกุลไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }
  if (sizeBytes > getUploadPolicy().maxBytes) {
    return NextResponse.json({ error: "ไฟล์มีขนาดใหญ่เกินกำหนด" }, { status: 400 });
  }

  const [assignment, student] = await Promise.all([
    prisma.assignment.findFirst({
      where: { id: assignmentId, classId: payload.classId, status: "PUBLISHED", mode: "SYSTEM_UPLOAD" },
      select: {
        id: true, ownerId: true, autoMarkAttendance: true, attendanceSessionId: true,
        classroom: { select: { name: true } },
        teachingAssignment: { select: { subject: { select: { code: true } } } },
      },
    }),
    prisma.student.findFirst({
      where: { id: payload.studentId, classId: payload.classId, isActive: true },
      select: { id: true, rollNo: true },
    }),
  ]);
  if (!assignment || !student) {
    return NextResponse.json({ error: "ไม่พบงานที่เปิดรับส่งหรือไม่มีสิทธิ์ส่งงาน" }, { status: 404 });
  }
  if (!student.rollNo.trim()) {
    return NextResponse.json({ error: "ยังไม่มีเลขที่นักเรียนในระบบ กรุณาแจ้งครูประจำวิชาให้บันทึกเลขที่ก่อนส่งงาน" }, { status: 409 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== sizeBytes || !verifyUploadBytes(bytes, contentType)) {
    return NextResponse.json({ error: "เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่แจ้ง" }, { status: 400 });
  }

  let driveFileId: string | null = null;
  try {
    const { gradeLevel, roomName } = folderLabels(assignment.classroom.name);
    if (!assignment.teachingAssignment.subject.code.trim()) {
      return NextResponse.json({ error: "งานนี้ยังไม่มีรหัสวิชา กรุณาแจ้งครูตรวจสอบข้อมูลรายวิชา" }, { status: 409 });
    }
    const destination = await ensureTeacherSubmissionFolder(
      assignment.ownerId,
      assignment.teachingAssignment.subject.code,
      gradeLevel,
      roomName,
      student.rollNo.trim(),
    );
    driveFileId = await uploadSubmissionToDrive({
      token: destination.token,
      folderId: destination.folderId,
      fileName,
      contentType,
      bytes,
    });

    const attendanceAvailability = assignment.autoMarkAttendance
      ? await getFeatureAvailability("attendance")
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const submissionKey = { assignmentId_studentId: { assignmentId, studentId: student.id } };
      const existing = await tx.submission.findUnique({
        where: submissionKey,
        select: { id: true, status: true, submittedAt: true },
      });
      if (existing?.status === "REVIEWED") throw new Error("SUBMISSION_ALREADY_REVIEWED");

      let submission: { id: string; submittedAt: Date };
      if (existing?.status === "RETURNED") {
        const changed = await tx.submission.updateMany({
          where: { id: existing.id, status: "RETURNED" },
          data: { status: "SUBMITTED", submittedAt: new Date(), score: null, feedback: "", reviewedAt: null },
        });
        if (changed.count !== 1) throw new Error("SUBMISSION_STATE_CHANGED");
        submission = await tx.submission.findUniqueOrThrow({ where: { id: existing.id }, select: { id: true, submittedAt: true } });
      } else if (existing) {
        const locked = await tx.submission.updateMany({
          where: { id: existing.id, status: "SUBMITTED" },
          data: { updatedAt: new Date() },
        });
        if (locked.count !== 1) throw new Error("SUBMISSION_ALREADY_REVIEWED");
        submission = existing;
      } else {
        submission = await tx.submission.create({
          data: { assignmentId, studentId: student.id },
          select: { id: true, submittedAt: true },
        });
      }

      const savedFile = await tx.submissionFile.create({
        data: { submissionId: submission.id, objectKey: null, driveFileId, fileName, contentType, sizeBytes },
        select: { id: true, fileName: true, contentType: true, sizeBytes: true },
      });

      if (assignment.autoMarkAttendance && assignment.attendanceSessionId && attendanceAvailability?.status === "AVAILABLE") {
        await tx.attendanceRecord.createMany({
          data: [{ sessionId: assignment.attendanceSessionId, studentId: student.id, status: "PRESENT", note: "เช็กชื่ออัตโนมัติจากการส่งงาน" }],
          skipDuplicates: true,
        });
      }
      return { submission, file: savedFile };
    });

    return NextResponse.json({
      ok: true,
      submission: { id: result.submission.id, submittedAt: result.submission.submittedAt.toISOString() },
      file: result.file,
    }, { status: 201 });
  } catch (error) {
    if (driveFileId) {
      await deleteDriveFile(assignment.ownerId, driveFileId).catch((cleanup) => console.error("[DriveUpload] orphan cleanup failed:", cleanup));
    }
    if (error instanceof Error && (error.message === "SUBMISSION_ALREADY_REVIEWED" || error.message === "SUBMISSION_STATE_CHANGED")) {
      return NextResponse.json({ error: "งานนี้ตรวจแล้ว ไม่สามารถเพิ่มหรือเปลี่ยนไฟล์ส่งงานได้" }, { status: 409 });
    }
    const mapped = driveError(error);
    if (mapped) return mapped;
    console.error("[DriveUpload] submission failed:", error);
    return NextResponse.json({ error: "อัปโหลดหรือบันทึกไฟล์ไปยัง Google Drive ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }
}
