import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAllowedResourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = await featureAvailabilityResponse("assignments");
  if (unavailable) return unavailable;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "ข้อมูลแก้ไขงานไม่ถูกต้อง" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : null;
  const dueAt = body.dueAt === null || body.dueAt === "" ? null : new Date(body.dueAt);
  // Omitted resourceUrl keeps compatibility with older clients; null/empty clears it.
  const resourceUrl = body.resourceUrl === undefined
    ? null
    : typeof body.resourceUrl === "string"
      ? body.resourceUrl.trim()
      : body.resourceUrl === null
        ? ""
        : undefined;

  if (
    description === null ||
    description.length > 5000 ||
    (body.dueAt !== null && body.dueAt !== "" && (!body.dueAt || Number.isNaN(dueAt?.getTime()))) ||
    resourceUrl === undefined ||
    (typeof resourceUrl === "string" && (resourceUrl.length > 2048 || (resourceUrl !== "" && !isAllowedResourceUrl(resourceUrl))))
  ) {
    return NextResponse.json({ error: "รายละเอียดงาน กำหนดส่ง หรือลิงก์ประกอบงานไม่ถูกต้อง (ลิงก์ต้องเป็น HTTPS)" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, groupId: true },
  });
  if (!assignment) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์แก้ไข" }, { status: 404 });

  const where = assignment.groupId
    ? { groupId: assignment.groupId, ownerId: session.user.id }
    : { id: assignment.id, ownerId: session.user.id };
  await prisma.assignment.updateMany({
    where,
    data: {
      description,
      dueAt,
      ...(resourceUrl !== null ? { resourceUrl: resourceUrl || null } : {}),
    },
  });
  return NextResponse.json({ ok: true, groupId: assignment.groupId });
}
