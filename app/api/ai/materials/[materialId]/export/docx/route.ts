import { prisma } from "@/lib/prisma";
import { aiErrorResponse, AIRequestError, requireAIUser } from "@/lib/ai-server";
import { createDocx, type DocxParagraph } from "@/lib/docx";
import type { MaterialContent } from "@/lib/ai-materials";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ materialId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const ownerId = await requireAIUser();
    const { materialId } = await params;
    const material = await prisma.generatedMaterial.findFirst({ where: { id: materialId, ownerId } });
    if (!material) throw new AIRequestError("ไม่พบชิ้นงานนี้ หรือไม่มีสิทธิ์เข้าถึง", 404);
    if (material.status !== "approved") throw new AIRequestError("ต้องให้ครูตรวจและอนุมัติก่อนส่งออก", 409);

    const content = material.content as MaterialContent;
    const paragraphs: DocxParagraph[] = [
      { text: material.title, style: "Title" },
      { text: `วิชา ${material.subject} | ระดับชั้น ${material.gradeLevel}`, bold: true },
      { text: `หัวข้อ: ${material.topic}` },
    ];
    if (content.overview) paragraphs.push({ text: content.overview });
    for (const objective of content.learningObjectives || []) paragraphs.push({ text: `• ${objective}` });
    if (material.kind === "exam") {
      if (content.instructions) paragraphs.push({ text: `คำชี้แจง: ${content.instructions}` });
      for (const question of content.questions || []) {
        paragraphs.push({ text: `${question.number}. ${question.prompt}`, style: "Heading2" });
        for (const choice of question.choices || []) paragraphs.push({ text: choice });
        paragraphs.push({ text: `เฉลย: ${question.answer}`, bold: true });
        if (question.rationale) paragraphs.push({ text: `เหตุผล: ${question.rationale}` });
        paragraphs.push({ text: `คะแนน: ${question.points}` });
      }
    } else {
      for (const section of content.sections || []) {
        paragraphs.push({ text: section.heading, style: "Heading2" });
        paragraphs.push({ text: section.body });
      }
    }
    paragraphs.push({ text: "สถานะ: ผ่านการตรวจสอบและอนุมัติโดยครู" });
    const buffer = createDocx(paragraphs);
    const safeTitle = material.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.docx`)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) { return aiErrorResponse(error); }
}
