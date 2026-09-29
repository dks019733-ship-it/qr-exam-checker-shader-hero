import { prisma } from "@/lib/prisma";
import { aiErrorResponse, requireAIUser } from "@/lib/ai-server";
import { generateMaterialContent, toMaterialDto, type GenerateMaterialInput } from "@/lib/ai-materials";

export async function POST(request: Request) {
  try {
    const ownerId = await requireAIUser();
    const body = await request.json().catch(() => ({})) as GenerateMaterialInput;
    const content = await generateMaterialContent(body);
    const title = body.kind === "exam" ? `ข้อสอบ ${body.subject} — ${body.topic}` : `${body.documentType || "เอกสาร"} ${body.subject} — ${body.topic}`;
    const row = await prisma.generatedMaterial.create({
      data: {
        ownerId,
        kind: body.kind,
        title: title.slice(0, 200),
        subject: body.subject.trim(),
        gradeLevel: body.gradeLevel.trim(),
        topic: body.topic.trim(),
        learningObjectives: body.learningObjectives?.trim() || "",
        documentType: body.kind === "document" ? body.documentType || "เอกสารประกอบการสอน" : null,
        content: content as any,
        status: "pending_review",
      },
    });
    return Response.json({ material: toMaterialDto(row) }, { status: 201 });
  } catch (error) { return aiErrorResponse(error); }
}
