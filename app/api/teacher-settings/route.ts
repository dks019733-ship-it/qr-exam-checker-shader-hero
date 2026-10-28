import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { defaultLearningArea: true } });
  return NextResponse.json({ defaultLearningArea: user?.defaultLearningArea || "" });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const defaultLearningArea = typeof body?.defaultLearningArea === "string" ? body.defaultLearningArea.trim() : null;
  if (defaultLearningArea === null || defaultLearningArea.length > 160) {
    return NextResponse.json({ error: "กลุ่มสาระต้องมีความยาวไม่เกิน 160 ตัวอักษร" }, { status: 400 });
  }
  const user = await prisma.user.update({ where: { id: session.user.id }, data: { defaultLearningArea }, select: { defaultLearningArea: true } });
  return NextResponse.json(user);
}
