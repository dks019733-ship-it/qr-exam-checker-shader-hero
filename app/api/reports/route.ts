import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exams = await prisma.exam.findMany({
    where: { ownerId: session.user.id },
    include: {
      class: { select: { id: true, name: true } },
      attempts: { include: { student: { select: { id: true, rollNo: true, studentNo: true, name: true } } }, orderBy: { updatedAt: "desc" } },
      _count: { select: { questions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(exams);
}
