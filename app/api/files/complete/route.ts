import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import { isObjectStorageConfigured, sanitizeUploadName, validateUploadInput, verifyStoredObject } from "@/lib/object-storage";

const EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

function extensionMatches(fileName: string, contentType: string) {
  const lower = fileName.toLocaleLowerCase("en");
  return (EXTENSIONS[contentType] ?? []).some((extension) => lower.endsWith(extension));
}

export async function POST(request: Request) {
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: "ระบบจัดเก็บไฟล์ยังไม่ได้ตั้งค่า" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const scope = body?.scope === "submission" ? "submission" : body?.scope === "assignment" ? "assignment" : null;
  const parentId = typeof body?.parentId === "string" ? body.parentId : "";
  const objectKey = typeof body?.objectKey === "string" ? body.objectKey : "";
  const fileName = typeof body?.fileName === "string" ? sanitizeUploadName(body.fileName) : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType.toLowerCase() : "";
  const sizeBytes = Number(body?.sizeBytes);

  const validationError = validateUploadInput(contentType, sizeBytes);
  if (!scope || !parentId || !objectKey || !fileName || validationError || !extensionMatches(fileName, contentType)) {
    return NextResponse.json({ error: validationError || "ชื่อไฟล์หรือข้อมูลไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  let studentId: string | null = null;
  let assignmentId = parentId;
  if (scope === "assignment") {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });
    const assignment = await prisma.assignment.findFirst({
      where: { id: parentId, ownerId: session.user.id, mode: { not: "GOOGLE_FORM" } },
      select: { id: true },
    });
    if (!assignment || !objectKey.startsWith(`assignment-files/${assignment.id}/`)) {
      return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์แนบไฟล์" }, { status: 404 });
    }
  } else {
    const cookieStore = await cookies();
    const token = cookieStore.get("student_token")?.value;
    const payload = token ? verifyStudentToken(token) : null;
    if (!payload?.studentId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบนักเรียน" }, { status: 401 });
    const assignment = await prisma.assignment.findFirst({
      where: { id: parentId, classId: payload.classId, status: "PUBLISHED", mode: "SYSTEM_UPLOAD" },
      select: { id: true, autoMarkAttendance: true, attendanceSessionId: true },
    });
    const student = await prisma.student.findFirst({
      where: { id: payload.studentId, classId: payload.classId, isActive: true },
      select: { id: true },
    });
    if (!assignment || !student || !objectKey.startsWith(`submission-files/${assignment.id}/${student.id}/`)) {
      return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์ส่งไฟล์" }, { status: 404 });
    }
    studentId = student.id;
  }

  try {
    const stored = await verifyStoredObject(objectKey);
    if (stored.sizeBytes !== sizeBytes || stored.contentType.toLowerCase() !== contentType) {
      return NextResponse.json({ error: "ข้อมูลไฟล์ที่อัปโหลดไม่ตรงกับข้อมูลที่แจ้งไว้" }, { status: 400 });
    }

    if (scope === "assignment") {
      const file = await prisma.assignmentFile.create({
        data: { assignmentId, objectKey, fileName, contentType, sizeBytes },
        select: { id: true, fileName: true, contentType: true, sizeBytes: true },
      });
      return NextResponse.json({ ok: true, file }, { status: 201 });
    }

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, status: "PUBLISHED", mode: "SYSTEM_UPLOAD" },
      select: { autoMarkAttendance: true, attendanceSessionId: true },
    });
    if (!assignment || !studentId) return NextResponse.json({ error: "ไม่พบงานที่เปิดรับส่ง" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: studentId! } },
        create: { assignmentId, studentId: studentId! },
        update: { submittedAt: new Date(), status: "SUBMITTED" },
        select: { id: true, submittedAt: true },
      });
      const file = await tx.submissionFile.create({
        data: { submissionId: submission.id, objectKey, fileName, contentType, sizeBytes },
        select: { id: true, fileName: true, contentType: true, sizeBytes: true },
      });

      if (assignment.autoMarkAttendance && assignment.attendanceSessionId) {
        const existing = await tx.attendanceRecord.findUnique({
          where: { sessionId_studentId: { sessionId: assignment.attendanceSessionId, studentId: studentId! } },
          select: { status: true },
        });
        // A leave record is an explicit teacher decision and must never be overwritten.
        if (existing?.status !== "LEAVE") {
          await tx.attendanceRecord.upsert({
            where: { sessionId_studentId: { sessionId: assignment.attendanceSessionId, studentId: studentId! } },
            create: { sessionId: assignment.attendanceSessionId, studentId: studentId!, status: "PRESENT", note: "เช็กชื่ออัตโนมัติจากการส่งงาน" },
            update: { status: "PRESENT", note: "เช็กชื่ออัตโนมัติจากการส่งงาน", markedAt: new Date() },
          });
        }
      }
      return { submission, file };
    });
    return NextResponse.json({
      ok: true,
      submission: { id: result.submission.id, submittedAt: result.submission.submittedAt.toISOString() },
      file: result.file,
    }, { status: 201 });
  } catch (error) {
    console.error("[FileUpload] completion failed:", error);
    return NextResponse.json({ error: "ตรวจสอบหรือบันทึกไฟล์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
