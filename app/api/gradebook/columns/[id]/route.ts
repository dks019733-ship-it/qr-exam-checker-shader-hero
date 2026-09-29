import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await prisma.gradeColumn.deleteMany({ where: { id, ownerId: session.user.id } });
  if (!result.count) return NextResponse.json({ error: "ไม่พบช่องคะแนน" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
