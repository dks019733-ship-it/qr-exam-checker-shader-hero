import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/object-storage";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });

  const { id, fileId } = await context.params;
  const selected = await prisma.assignmentFile.findFirst({
    where: { id: fileId, assignmentId: id, assignment: { ownerId: session.user.id } },
    include: { assignment: { select: { id: true, groupId: true, ownerId: true } } },
  });
  if (!selected) return NextResponse.json({ error: "ไม่พบไฟล์หรือไม่มีสิทธิ์แก้ไข" }, { status: 404 });

  const groupWhere = selected.assignment.groupId
    ? { groupId: selected.assignment.groupId, ownerId: session.user.id }
    : { id: selected.assignment.id, ownerId: session.user.id };
  const group = await prisma.assignment.findMany({
    where: groupWhere,
    select: { id: true, _count: { select: { submissions: true } } },
  });
  if (group.some((item) => item._count.submissions > 0)) {
    return NextResponse.json({ error: "งานนี้มีนักเรียนส่งแล้ว จึงไม่อนุญาตให้ลบไฟล์เดิมเพื่อรักษาหลักฐานงานที่ส่ง กรุณาเพิ่มไฟล์ฉบับแก้ไขแทน" }, { status: 409 });
  }

  const files = await prisma.assignmentFile.findMany({
    where: {
      assignmentId: { in: group.map((item) => item.id) },
      fileName: selected.fileName,
      contentType: selected.contentType,
      sizeBytes: selected.sizeBytes,
    },
    select: { id: true, objectKey: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.assignmentFile.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
  });
  const cleanup = await Promise.allSettled(files.map((file) => deleteStoredObject(file.objectKey)));
  const failedCleanup = cleanup.filter((result) => result.status === "rejected").length;
  if (failedCleanup) console.error("[AssignmentFiles] storage cleanup failed", { count: failedCleanup });
  return NextResponse.json({ ok: true, removedCount: files.length, cleanupPending: failedCleanup > 0 });
}
