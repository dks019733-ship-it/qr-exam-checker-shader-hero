import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exams = await prisma.exam.findMany({
    where: { ownerId: session.user.id },
    include: { class: true, questions: { orderBy: { number: "asc" } }, _count: { select: { attempts: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(exams);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const classId = typeof body.classId === "string" && body.classId ? body.classId : null;
  if (!title || title.length > 200 || subject.length > 200) {
    return NextResponse.json({ error: "ข้อมูลข้อสอบไม่ถูกต้อง" }, { status: 400 });
  }

  if (classId) {
    const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId: session.user.id } });
    if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  }

  const exam = await prisma.exam.create({
    data: { ownerId: session.user.id, title, subject, classId },
  });
  return NextResponse.json(exam, { status: 201 });
}
