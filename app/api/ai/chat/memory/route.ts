import { prisma } from "@/lib/prisma";
import { aiErrorResponse, AIRequestError, requireAIUser } from "@/lib/ai-server";

const knownPreferences: Record<string, string> = {
  concise: "ตอบให้กระชับ",
  detailed: "อธิบายอย่างละเอียด",
  bullets: "จัดคำตอบเป็นข้อหรือลำดับรายการ",
  examples: "เพิ่มตัวอย่างประกอบเมื่อเหมาะสม",
  "no-emoji": "ไม่ใช้ emoji",
  thai: "ตอบเป็นภาษาไทย",
};

function parsePreferences(value: string) {
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === "string" && id in knownPreferences) : [];
  } catch { return []; }
}

export async function GET() {
  try {
    const ownerId = await requireAIUser();
    const memory = await prisma.teacherAiMemory.findUnique({ where: { ownerId } });
    const preferences = parsePreferences(memory?.preferences || "[]");
    return Response.json({ enabled: memory?.enabled ?? true, preferences: preferences.map((id) => knownPreferences[id]) });
  } catch (error) { return aiErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const ownerId = await requireAIUser();
    const body = await request.json().catch(() => ({}));
    if (typeof body?.enabled !== "boolean") throw new AIRequestError("การตั้งค่าความจำไม่ถูกต้อง", 400);
    const memory = await prisma.teacherAiMemory.upsert({
      where: { ownerId },
      create: { ownerId, enabled: body.enabled },
      update: { enabled: body.enabled },
    });
    return Response.json({ enabled: memory.enabled, preferences: parsePreferences(memory.preferences).map((id) => knownPreferences[id]) });
  } catch (error) { return aiErrorResponse(error); }
}

export async function DELETE() {
  try {
    const ownerId = await requireAIUser();
    await prisma.teacherAiMemory.deleteMany({ where: { ownerId } });
    return Response.json({ enabled: true, preferences: [] });
  } catch (error) { return aiErrorResponse(error); }
}
