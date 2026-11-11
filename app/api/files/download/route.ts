import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";
import { createDownloadUrl } from "@/lib/object-storage";
import { createDriveDownloadResponse } from "@/lib/google-drive-storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind"), fileId = params.get("fileId") || "", stream = params.get("stream") === "1";
  if (!fileId || (kind !== "assignment" && kind !== "submission")) return NextResponse.json({ error: "คำขอไฟล์ไม่ถูกต้อง" }, { status: 400 });

  const teacherSession = await auth();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("student_token")?.value;
  const payload = rawToken ? verifyStudentToken(rawToken) : null;

  if (kind === "assignment") {
    const file = await prisma.assignmentFile.findUnique({ where: { id: fileId }, include: { assignment: { select: { ownerId: true, classId: true, status: true } } } });
    if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
    const isTeacher = teacherSession?.user?.id === file.assignment.ownerId;
    const student = payload?.studentId ? await prisma.student.findFirst({ where: { id: payload.studentId, classId: file.assignment.classId, isActive: true }, select: { id: true } }) : null;
    if (!isTeacher && !(student && file.assignment.status === "PUBLISHED")) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงไฟล์นี้" }, { status: 403 });
    try { return NextResponse.json({ url: await createDownloadUrl(file.objectKey), expiresIn: 180 }); }
    catch (error) { console.error("[FileDownload] assignment signing failed:", error); return NextResponse.json({ error: "ไม่สามารถเปิดไฟล์ได้" }, { status: 500 }); }
  }

  const file = await prisma.submissionFile.findUnique({
    where: { id: fileId },
    include: { submission: { include: { assignment: { select: { ownerId: true, classId: true } } } } },
  });
  if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  const isTeacher = teacherSession?.user?.id === file.submission.assignment.ownerId;
  const isStudent = payload?.studentId === file.submission.studentId && payload.classId === file.submission.assignment.classId;
  const student = isStudent ? await prisma.student.findFirst({ where: { id: file.submission.studentId, classId: file.submission.assignment.classId, isActive: true }, select: { id: true } }) : null;
  if (!isTeacher && !student) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงไฟล์นี้" }, { status: 403 });

  if (file.driveFileId) {
    if (!stream) return NextResponse.json({ url: "/api/files/download?kind=submission&fileId=" + encodeURIComponent(file.id) + "&stream=1" });
    try { return await createDriveDownloadResponse(file.submission.assignment.ownerId, file.driveFileId, file.fileName, file.contentType); }
    catch (error) { console.error("[FileDownload] Drive fetch failed:", error); return NextResponse.json({ error: "ไม่สามารถเปิดไฟล์จาก Google Drive ได้" }, { status: 502 }); }
  }
  if (!file.objectKey) return NextResponse.json({ error: "ไม่พบตำแหน่งจัดเก็บไฟล์" }, { status: 500 });
  try { return NextResponse.json({ url: await createDownloadUrl(file.objectKey), expiresIn: 180 }); }
  catch (error) { console.error("[FileDownload] signing failed:", error); return NextResponse.json({ error: "ไม่สามารถเปิดไฟล์ได้" }, { status: 500 }); }
}
