import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบครู" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!id || !code || code.length > 40 || !name || name.length > 120) {
    return NextResponse.json({ error: "กรุณาระบุรหัสวิชาและชื่อวิชาให้ถูกต้อง" }, { status: 400 });
  }

  const teachingAssignment = await prisma.teachingAssignment.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, subjectId: true },
  });
  if (!teachingAssignment) return NextResponse.json({ error: "ไม่พบรายวิชาหรือไม่มีสิทธิ์แก้ไข" }, { status: 404 });

  try {
    const subject = await prisma.subject.update({
      where: { id: teachingAssignment.subjectId, ownerId: session.user.id },
      data: { code, name },
      select: { id: true, code: true, name: true },
    });
    return NextResponse.json({ subject });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "รหัสวิชานี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น" }, { status: 409 });
    }
    console.error("[TeachingAssignments] subject update failed", error);
    return NextResponse.json({ error: "แก้ไขรายวิชาไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
