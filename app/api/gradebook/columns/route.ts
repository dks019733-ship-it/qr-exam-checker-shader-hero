import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id: unknown) => typeof id === "string" && id.length <= 100))] as string[] : [];
  if (!ids.length || ids.length > 100) return NextResponse.json({ error: "เลือกช่องคะแนน 1–100 ช่องก่อนลบ" }, { status: 400 });
  const linked = await prisma.gradeColumn.findMany({ where: { id: { in: ids }, ownerId: session.user.id, assignmentId: { not: null } }, select: { id: true } });
  if (linked.length) return NextResponse.json({ error: "มีช่องคะแนนที่เชื่อมกับงานมอบหมายอยู่ กรุณานำช่องเหล่านี้ออกจากรายการก่อนลบ" }, { status: 409 });
  const result = await prisma.gradeColumn.deleteMany({ where: { id: { in: ids }, ownerId: session.user.id } });
  return NextResponse.json({ deleted: result.count });
}
