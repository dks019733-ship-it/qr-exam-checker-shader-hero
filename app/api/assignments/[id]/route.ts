import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "PUBLISHED" && status !== "CLOSED" && status !== "DRAFT") {
    return NextResponse.json({ error: "สถานะงานไม่ถูกต้อง" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    include: { _count: { select: { files: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  if (status === "PUBLISHED") {
    if (assignment.mode === "GOOGLE_FORM" && !assignment.googleFormUrl) {
      return NextResponse.json({ error: "กรุณากำหนดลิงก์ Google Forms ก่อนเผยแพร่" }, { status: 400 });
    }
    if (assignment.mode === "SYSTEM_UPLOAD" && assignment._count.files === 0) {
      return NextResponse.json({ error: "กรุณาแนบไฟล์คำสั่งงานก่อนเผยแพร่" }, { status: 400 });
    }
  }

  if (status === "PUBLISHED" && assignment.groupId) {
    const group = await prisma.assignment.findMany({
      where: { groupId: assignment.groupId, ownerId: session.user.id },
      include: { _count: { select: { files: true } } },
    });
    const invalid = group.find((item) =>
      (item.mode === "GOOGLE_FORM" && !item.googleFormUrl) ||
      (item.mode === "SYSTEM_UPLOAD" && item._count.files === 0)
    );
    if (invalid) {
      return NextResponse.json({ error: `งานในห้อง ${invalid.classId} ยังตั้งค่าไม่ครบ จึงเผยแพร่ทั้งชุดไม่ได้` }, { status: 400 });
    }
    await prisma.assignment.updateMany({
      where: { groupId: assignment.groupId, ownerId: session.user.id },
      data: { status },
    });
    return NextResponse.json({ id: assignment.id, groupId: assignment.groupId, status });
  }

  if (assignment.groupId) {
    await prisma.assignment.updateMany({
      where: { groupId: assignment.groupId, ownerId: session.user.id },
      data: { status },
    });
    return NextResponse.json({ id: assignment.id, groupId: assignment.groupId, status });
  }

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: { status },
    select: { id: true, title: true, status: true, mode: true, updatedAt: true },
  });
  return NextResponse.json(updated);
}
