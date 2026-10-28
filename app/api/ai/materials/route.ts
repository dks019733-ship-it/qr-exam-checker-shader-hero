import { prisma } from "@/lib/prisma";
import { aiErrorResponse, requireAIUser } from "@/lib/ai-server";
import { toMaterialDto } from "@/lib/ai-materials";

export async function GET() {
  try {
    const ownerId = await requireAIUser();
    const rows = await prisma.generatedMaterial.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });
    return Response.json({ materials: rows.map(toMaterialDto) });
  } catch (error) { return aiErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const ownerId = await requireAIUser();
    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id: unknown) => typeof id === "string" && id.length <= 100))] as string[] : [];
    if (!ids.length || ids.length > 100) return Response.json({ error: "เลือกงาน 1–100 รายการก่อนลบ" }, { status: 400 });
    const result = await prisma.generatedMaterial.deleteMany({ where: { id: { in: ids }, ownerId } });
    return Response.json({ deleted: result.count });
  } catch (error) { return aiErrorResponse(error); }
}
