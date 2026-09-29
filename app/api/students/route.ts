import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });

  const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId: session.user.id } });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  const students = await prisma.student.findMany({
    where: { classId, isActive: true },
    select: { id: true, rollNo: true, studentNo: true, name: true, qrToken: true },
    orderBy: [{ rollNo: "asc" }, { studentNo: "asc" }],
  });
  return NextResponse.json(students);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });
  const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId: session.user.id }, select: { id: true } });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  const result = await prisma.student.updateMany({ where: { classId, isActive: true }, data: { isActive: false } });
  return NextResponse.json({ ok: true, count: result.count });
}
