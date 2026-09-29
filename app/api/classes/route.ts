import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classes = await prisma.class.findMany({
    where: { ownerId: session.user.id },
    include: { _count: { select: { students: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return NextResponse.json({ error: "ชื่อห้องไม่ถูกต้อง" }, { status: 400 });

  const existing = await prisma.class.findFirst({ where: { ownerId: session.user.id, name } });
  if (existing) return NextResponse.json(existing);

  const created = await prisma.class.create({ data: { ownerId: session.user.id, name } });
  return NextResponse.json(created, { status: 201 });
}
