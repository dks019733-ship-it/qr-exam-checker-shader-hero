import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id: unknown) => typeof id === "string" && id.length <= 100))] as string[] : [];
  if (!ids.length || ids.length > 100) return NextResponse.json({ error: "เลือกช่องคะแนน 1–100 ช่องก่อนลบ" }, { status: 400 });
  const result = await prisma.gradeColumn.deleteMany({ where: { id: { in: ids }, ownerId: session.user.id } });
  return NextResponse.json({ deleted: result.count });
}
