import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { studentQrPngBuffer } from "@/lib/qr";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const student = await prisma.student.findFirst({
    where: { id, class: { ownerId: session.user.id } },
    select: { qrToken: true },
  });
  if (!student) return NextResponse.json({ error: "ไม่พบนักเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  const size = Number(new URL(request.url).searchParams.get("size") ?? 240);
  const safeSize = Number.isFinite(size) ? Math.min(Math.max(size, 60), 1000) : 240;

  const png = await studentQrPngBuffer(student.qrToken, safeSize);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
