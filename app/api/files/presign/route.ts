import { featureAvailabilityResponse } from "@/lib/feature-availability";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import {
  createUploadUrl,
  getUploadPolicy,
  isObjectStorageConfigured,
  sanitizeUploadName,
  validateUploadInput,
} from "@/lib/object-storage";

const EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

export async function POST(request: Request) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: "ระบบจัดเก็บไฟล์ยังไม่ได้ตั้งค่า กรุณาติดต่อครูผู้ดูแล" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const scope = body?.scope === "submission" ? "submission" : body?.scope === "assignment" ? "assignment" : null;
  const parentId = typeof body?.parentId === "string" ? body.parentId : "";
  const fileName = typeof body?.fileName === "string" ? sanitizeUploadName(body.fileName) : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType.toLowerCase() : "";
  const sizeBytes = Number(body?.sizeBytes);
  const validationError = validateUploadInput(contentType, sizeBytes);
  const extensionMatches = (EXTENSIONS[contentType] ?? []).some((extension) => fileName.toLowerCase().endsWith(extension));
  if (!scope || !parentId || !fileName || validationError || !extensionMatches) {
    return NextResponse.json({ error: validationError || "ข้อมูลไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  let objectKey = "";
  if (scope === "assignment") {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });
    const assignment = await prisma.assignment.findFirst({
      where: { id: parentId, ownerId: session.user.id, mode: { not: "GOOGLE_FORM" } },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์แนบไฟล์" }, { status: 404 });
    objectKey = `assignment-files/${assignment.id}/${crypto.randomUUID()}`;
  } else {
    const cookieStore = await cookies();
    const token = cookieStore.get("student_token")?.value;
    const payload = token ? verifyStudentToken(token) : null;
    if (!payload?.studentId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบนักเรียน" }, { status: 401 });
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: parentId,
        classId: payload.classId,
        status: "PUBLISHED",
        mode: "SYSTEM_UPLOAD",
      },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "ไม่พบงานที่เปิดรับส่งหรือไม่มีสิทธิ์" }, { status: 404 });
    const student = await prisma.student.findFirst({
      where: { id: payload.studentId, classId: payload.classId, isActive: true },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียน" }, { status: 404 });
    objectKey = `submission-files/${assignment.id}/${student.id}/${crypto.randomUUID()}`;
  }

  try {
    const uploadUrl = await createUploadUrl(objectKey, contentType);
    return NextResponse.json({
      uploadUrl,
      objectKey,
      fileName,
      contentType,
      sizeBytes,
      expiresIn: 7200,
      maxBytes: getUploadPolicy().maxBytes,
    });
  } catch (error) {
    console.error("[FileUpload] presign failed:", error);
    return NextResponse.json({ error: "ไม่สามารถเตรียมการอัปโหลดไฟล์ได้" }, { status: 500 });
  }
}
