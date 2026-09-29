import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const rollNo = typeof body.rollNo === "string" ? body.rollNo.trim() : "";
  const studentNo = typeof body.studentNo === "string" ? body.studentNo.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!rollNo || !studentNo || !name || rollNo.length > 20 || studentNo.length > 50 || name.length > 200) {
    return NextResponse.json({ error: "ข้อมูลนักเรียนไม่ถูกต้อง" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id, class: { ownerId: session.user.id } },
    select: { id: true, classId: true },
  });
  if (!student) return NextResponse.json({ error: "ไม่พบนักเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  try {
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { rollNo, studentNo, name },
      select: { id: true, rollNo: true, studentNo: true, name: true, qrToken: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "รหัสนักเรียนนี้มีอยู่แล้วในห้องเรียน" }, { status: 409 });
    }
    return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลนักเรียนได้" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const student = await prisma.student.findFirst({
    where: { id, class: { ownerId: session.user.id }, isActive: true },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "ไม่พบนักเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  await prisma.student.update({ where: { id: student.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
