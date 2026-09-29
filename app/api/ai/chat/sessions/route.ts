import { prisma } from "@/lib/prisma";
import { AIRequestError, aiErrorResponse, requireAIUser } from "@/lib/ai-server";

export async function GET() {
  try {
    const ownerId = await requireAIUser();
    const rows = await prisma.aiChatSession.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });
    return Response.json({ sessions: rows.map((row) => ({ id: row.id, title: row.title, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() })) });
  } catch (error) { return aiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireAIUser();
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "สนทนาใหม่";
    const row = await prisma.aiChatSession.create({ data: { ownerId, title: title || "สนทนาใหม่" } });
    return Response.json({ session: { id: row.id, title: row.title, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() } }, { status: 201 });
  } catch (error) { return aiErrorResponse(error); }
}
