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
