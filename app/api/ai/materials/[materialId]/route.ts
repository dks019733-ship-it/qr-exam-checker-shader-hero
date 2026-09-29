import { prisma } from "@/lib/prisma";
import { aiErrorResponse, AIRequestError, requireAIUser } from "@/lib/ai-server";
import { normalizeContent, toMaterialDto, type MaterialKind } from "@/lib/ai-materials";

type RouteContext = { params: Promise<{ materialId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const ownerId = await requireAIUser();
    const { materialId } = await params;
    const row = await prisma.generatedMaterial.findFirst({ where: { id: materialId, ownerId }, include: { googleForm: true } });
    if (!row) throw new AIRequestError("ไม่พบชิ้นงานนี้ หรือไม่มีสิทธิ์เข้าถึง", 404);
    return Response.json({ material: toMaterialDto(row) });
  } catch (error) { return aiErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const ownerId = await requireAIUser();
    const { materialId } = await params;
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AIRequestError("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);
    const current = await prisma.generatedMaterial.findFirst({ where: { id: materialId, ownerId } });
    if (!current) throw new AIRequestError("ไม่พบชิ้นงานนี้ หรือไม่มีสิทธิ์เข้าถึง", 404);
    if (current.status === "approved") throw new AIRequestError("ชิ้นงานที่อนุมัติแล้วถูกล็อกไว้ หากต้องการแก้ไขกรุณาสร้างฉบับใหม่", 409);
    if (body.status !== undefined && !["pending_review", "approved"].includes(body.status)) throw new AIRequestError("สถานะไม่ถูกต้อง", 400);
    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200)) throw new AIRequestError("ชื่อชิ้นงานไม่ถูกต้อง", 400);
    if (body.reviewNotes !== undefined && (typeof body.reviewNotes !== "string" || body.reviewNotes.length > 3000)) throw new AIRequestError("หมายเหตุการตรวจไม่ถูกต้อง", 400);
    const content = body.content === undefined ? current.content : normalizeContent(current.kind as MaterialKind, body.content);
    const status = body.status || "pending_review";
    const update = await prisma.generatedMaterial.updateMany({
      where: { id: materialId, ownerId, status: "pending_review" },
      data: {
        title: body.title?.trim() ?? current.title,
        content: content as any,
        reviewNotes: body.reviewNotes?.trim() ?? current.reviewNotes,
        status,
        reviewedAt: status === "approved" ? new Date() : null,
      },
    });
    if (update.count !== 1) throw new AIRequestError("ชิ้นงานนี้ถูกอนุมัติแล้ว จึงแก้ไขไม่ได้", 409);
    const saved = await prisma.generatedMaterial.findUniqueOrThrow({ where: { id: materialId } });
    return Response.json({ material: toMaterialDto(saved) });
  } catch (error) { return aiErrorResponse(error); }
}
