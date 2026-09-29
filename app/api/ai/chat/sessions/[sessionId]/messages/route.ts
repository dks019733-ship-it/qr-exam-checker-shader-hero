import { prisma } from "@/lib/prisma";
import { aiErrorResponse, AIRequestError, generateWithGemini, requireAIUser } from "@/lib/ai-server";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const ownerId = await requireAIUser();
    const { sessionId } = await params;
    const session = await prisma.aiChatSession.findFirst({ where: { id: sessionId, ownerId }, select: { id: true } });
    if (!session) throw new AIRequestError("ไม่พบห้องสนทนานี้ หรือไม่มีสิทธิ์เข้าถึง", 404);
    const rows = await prisma.aiChatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
    return Response.json({ messages: rows.map((row) => ({ id: row.id, role: row.role, content: row.content, created_at: row.createdAt.toISOString() })) });
  } catch (error) { return aiErrorResponse(error); }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const ownerId = await requireAIUser();
    const { sessionId } = await params;
    if (Number(request.headers.get("content-length") || 0) > 200_000) throw new AIRequestError("ข้อความที่ส่งมีขนาดใหญ่เกินไป", 413);
    const body = await request.json().catch(() => ({}));
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) throw new AIRequestError("กรุณาพิมพ์ข้อความก่อนส่ง", 400);
    if (content.length > 12000) throw new AIRequestError("ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)", 400);

    const session = await prisma.aiChatSession.findFirst({ where: { id: sessionId, ownerId }, select: { id: true } });
    if (!session) throw new AIRequestError("ไม่พบห้องสนทนานี้ หรือไม่มีสิทธิ์เข้าถึง", 404);
    const history = (await prisma.aiChatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: 40 })).reverse();
    const replyText = await generateWithGemini([
      ...history.map((item) => ({ role: item.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: item.content }] })),
      { role: "user", parts: [{ text: content }] },
    ]);
    const [, reply] = await prisma.$transaction(async (transaction) => {
      const userMessage = await transaction.aiChatMessage.create({ data: { sessionId, role: "user", content } });
      const savedReply = await transaction.aiChatMessage.create({ data: { sessionId, role: "assistant", content: replyText } });
      await transaction.aiChatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date(), ...(history.length === 0 ? { title: content.slice(0, 60) } : {}) } });
      return [userMessage, savedReply] as const;
    });
    return Response.json({ reply: { id: reply.id, role: reply.role, content: reply.content, created_at: reply.createdAt.toISOString() } }, { status: 201 });
  } catch (error) { return aiErrorResponse(error); }
}
