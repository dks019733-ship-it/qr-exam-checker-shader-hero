import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const dueAt = body?.dueAt === null || body?.dueAt === "" ? null : new Date(body?.dueAt);
  if (description === null || description.length > 5000 || (dueAt && Number.isNaN(dueAt.getTime()))) {
    return NextResponse.json({ error: "รายละเอียดงานหรือกำหนดส่งไม่ถูกต้อง" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, groupId: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์แก้ไข" }, { status: 404 });

  const where = assignment.groupId
    ? { groupId: assignment.groupId, ownerId: session.user.id }
    : { id: assignment.id, ownerId: session.user.id };
  await prisma.assignment.updateMany({ where, data: { description, dueAt } });
  return NextResponse.json({ ok: true, groupId: assignment.groupId });
}
