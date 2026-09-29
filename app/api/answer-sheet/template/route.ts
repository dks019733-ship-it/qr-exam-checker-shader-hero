import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answerSheetTemplateSchema, isSafeImageDataUrl } from "@/lib/answer-sheet";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await prisma.answerSheetTemplate.findUnique({
    where: { ownerId: session.user.id },
  });

  return NextResponse.json(template);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = answerSheetTemplateSchema.safeParse(body);
  if (!parsed.success || !isSafeImageDataUrl(parsed.data.logoDataUrl)) {
    return NextResponse.json({ error: "ข้อมูลกระดาษคำตอบไม่ถูกต้อง" }, { status: 400 });
  }

  const template = await prisma.answerSheetTemplate.upsert({
    where: { ownerId: session.user.id },
    create: { ownerId: session.user.id, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(template);
}
