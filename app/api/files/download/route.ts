import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import { createDownloadUrl, isObjectStorageConfigured } from "@/lib/object-storage";

export async function GET(request: Request) {
  if (!isObjectStorageConfigured()) return NextResponse.json({ error: "ระบบจัดเก็บไฟล์ยังไม่ได้ตั้งค่า" }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const fileId = params.get("fileId") || "";
  if (!fileId || (kind !== "assignment" && kind !== "submission")) {
    return NextResponse.json({ error: "คำขอไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  let objectKey: string | null = null;
  if (kind === "assignment") {
    const file = await prisma.assignmentFile.findUnique({
      where: { id: fileId },
      include: { assignment: { select: { ownerId: true, classId: true, status: true } } },
    });
    if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });

    const teacherSession = await auth();
    if (teacherSession?.user?.id === file.assignment.ownerId) {
      objectKey = file.objectKey;
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get("student_token")?.value;
      const payload = token ? verifyStudentToken(token) : null;
      const student = payload?.studentId
        ? await prisma.student.findFirst({
            where: { id: payload.studentId, classId: file.assignment.classId, isActive: true },
            select: { id: true },
          })
        : null;
      if (student && file.assignment.status === "PUBLISHED") objectKey = file.objectKey;
    }
  } else {
    const file = await prisma.submissionFile.findUnique({
      where: { id: fileId },
      include: {
        submission: {
          include: {
            assignment: { select: { ownerId: true, classId: true } },
          },
        },
      },
    });
    if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });

    const teacherSession = await auth();
    if (teacherSession?.user?.id === file.submission.assignment.ownerId) {
      objectKey = file.objectKey;
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get("student_token")?.value;
      const payload = token ? verifyStudentToken(token) : null;
      if (payload?.studentId === file.submission.studentId && payload.classId === file.submission.assignment.classId) {
        objectKey = file.objectKey;
      }
    }
  }

  if (!objectKey) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงไฟล์นี้" }, { status: 403 });
  try {
    const url = await createDownloadUrl(objectKey);
    return NextResponse.json({ url, expiresIn: 180 });
  } catch (error) {
    console.error("[FileDownload] signing failed:", error);
    return NextResponse.json({ error: "ไม่สามารถเปิดไฟล์ได้" }, { status: 500 });
  }
}
