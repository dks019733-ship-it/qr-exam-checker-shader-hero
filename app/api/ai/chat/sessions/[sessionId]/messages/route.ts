import { prisma } from "@/lib/prisma";
import { aiErrorResponse, AIRequestError, generateWorksheetImage, generateWithGemini, requireAIUser } from "@/lib/ai-server";
import { sanitizeTeacherAiProfile } from "@/lib/teacher-ai-profile";

type RouteContext = { params: Promise<{ sessionId: string }> };
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 4;
const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/csv"]);
const learnedPreferences = [
  { id: "concise", pattern: /(?:ตอบ|ขอ)?\s*(?:ให้)?(?:สั้น|กระชับ)(?:ๆ|หน่อย|นะ)?/iu, text: "ตอบให้กระชับ" },
  { id: "detailed", pattern: /(?:ตอบ|อธิบาย|ขอ)?\s*(?:ให้)?(?:ละเอียด|ลงรายละเอียด)(?:หน่อย|นะ)?/iu, text: "อธิบายอย่างละเอียด" },
  { id: "bullets", pattern: /(?:ตอบ|จัด|เขียน)?\s*(?:เป็น|แบบ)?(?:ข้อ|รายการ|bullet)(?:ๆ|หน่อย|นะ)?/iu, text: "จัดคำตอบเป็นข้อหรือลำดับรายการ" },
  { id: "examples", pattern: /(?:ขอ|ช่วย)?\s*(?:ยกตัวอย่าง|มีตัวอย่าง)(?:ด้วย|หน่อย|นะ)?/iu, text: "เพิ่มตัวอย่างประกอบเมื่อเหมาะสม" },
  { id: "no-emoji", pattern: /ไม่ใช้(?:อีโมจิ|emoji)/iu, text: "ไม่ใช้ emoji" },
  { id: "thai", pattern: /(?:ตอบ|ใช้)(?:เป็น)?ภาษาไทย/iu, text: "ตอบเป็นภาษาไทย" },
];

function getMemoryPreferences(raw: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => learnedPreferences.some((preference) => preference.id === item)) : [];
  } catch {
    return [];
  }
}

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
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 17_000_000) throw new AIRequestError("ไฟล์แนบมีขนาดรวมเกิน 12 MB", 413);

    let content: string;
    let profileValue: unknown;
    let mode: string;
    let files: File[] = [];
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const body = await request.formData();
      content = typeof body.get("content") === "string" ? (body.get("content") as string).trim() : "";
      try {
        profileValue = body.get("teacherProfile") ? JSON.parse(String(body.get("teacherProfile"))) : undefined;
      } catch {
        throw new AIRequestError("ข้อมูลโปรไฟล์ผู้ช่วยไม่ถูกต้อง", 400);
      }
      mode = String(body.get("mode") || "chat");
      const entries = body.getAll("files");
      if (entries.some((entry) => !(entry instanceof File))) throw new AIRequestError("ข้อมูลไฟล์แนบไม่ถูกต้อง", 400);
      files = entries as File[];
      if (files.some((file) => file.size === 0)) throw new AIRequestError("ไม่สามารถแนบไฟล์ว่างได้", 400);
    } else {
      const body = await request.json().catch(() => ({}));
      content = typeof body?.content === "string" ? body.content.trim() : "";
      profileValue = body?.teacherProfile;
      mode = typeof body?.mode === "string" ? body.mode : "chat";
    }

    if (!content && files.length === 0) throw new AIRequestError("กรุณาพิมพ์ข้อความหรือแนบไฟล์ก่อนส่ง", 400);
    if (content.length > 12000) throw new AIRequestError("ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)", 400);
    if (!["chat", "worksheet", "image"].includes(mode)) throw new AIRequestError("ไม่รองรับโหมด AI ที่เลือก", 400);
    if (files.length > MAX_FILES) throw new AIRequestError(`แนบไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์ต่อครั้ง`, 400);
    let totalBytes = 0;
    const fileParts = [];
    const imageReferences: { mimeType: string; data: string }[] = [];
    const filenames: string[] = [];
    for (const file of files) {
      if (!allowedTypes.has(file.type)) throw new AIRequestError(`ไม่รองรับไฟล์ "${file.name}" (${file.type || "ไม่ทราบชนิด"}) กรุณาใช้ PDF, PNG, JPG, WEBP, TXT หรือ CSV`, 415);
      if (mode === "image" && !file.type.startsWith("image/")) throw new AIRequestError(`โหมดสร้างภาพรองรับไฟล์อ้างอิงเฉพาะ PNG, JPG หรือ WebP (ไฟล์ "${file.name}" ใช้ไม่ได้)`, 415);
      if (file.size > MAX_FILE_BYTES) throw new AIRequestError(`ไฟล์ "${file.name}" มีขนาดเกิน 8 MB`, 413);
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) throw new AIRequestError("ไฟล์แนบมีขนาดรวมเกิน 12 MB", 413);
      const bytes = Buffer.from(await file.arrayBuffer());
      const name = file.name.replace(/[\\/\r\n]/g, "_").slice(0, 120);
      filenames.push(name);
      if (file.type === "text/plain" || file.type === "text/csv") {
        const text = bytes.toString("utf8");
        if (text.includes("\u0000")) throw new AIRequestError(`ไฟล์ "${name}" ไม่ใช่ไฟล์ข้อความที่รองรับ`, 415);
        fileParts.push({ text: `\n\n[เนื้อหาไฟล์แนบ: ${name}]\n${text.slice(0, 100_000)}` });
      } else {
        const validSignature =
          (file.type === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") ||
          (file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
          (file.type === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP");
        if (!validSignature) throw new AIRequestError(`เนื้อหาไฟล์ "${name}" ไม่ตรงกับชนิดไฟล์ที่รองรับ`, 415);
        fileParts.push({ inline_data: { mime_type: file.type, data: bytes.toString("base64") } });
        if (mode === "image") imageReferences.push({ mimeType: file.type, data: bytes.toString("base64") });
      }
    }

    const teacherProfile = sanitizeTeacherAiProfile(profileValue);
    const session = await prisma.aiChatSession.findFirst({ where: { id: sessionId, ownerId }, select: { id: true } });
    if (!session) throw new AIRequestError("ไม่พบห้องสนทนานี้ หรือไม่มีสิทธิ์เข้าถึง", 404);
    const history = (await prisma.aiChatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: 40 })).reverse();
    const memory = await prisma.teacherAiMemory.findUnique({ where: { ownerId } });
    const preferences = memory?.enabled ? getMemoryPreferences(memory.preferences) : [];
    const memoryContext = preferences.map((id) => learnedPreferences.find((item) => item.id === id)?.text).filter(Boolean).join("; ");
    const learned = (memory?.enabled ?? true) ? learnedPreferences.filter((item) => item.pattern.test(content)).map((item) => item.id) : [];
    const nextPreferences = [...new Set([...preferences, ...learned])];
    const prompt = content || "ช่วยอ่านและสรุปไฟล์ที่แนบมา พร้อมชี้ประเด็นที่ครูสามารถนำไปใช้ได้";
    const savedContent = `${content || "ช่วยอ่านและสรุปไฟล์ที่แนบมา"}${filenames.length ? `\n\n📎 ไฟล์แนบ: ${filenames.join(", ")}` : ""}`;
    const imagePrompt = [
      "สร้างภาพประกอบต้นฉบับสำหรับใบงานการศึกษา จัดองค์ประกอบชัดเจน เหมาะกับนักเรียน และสอดคล้องกับคำขอของครู หลีกเลี่ยงข้อความยาวหรือข้อความที่อ่านไม่ชัด เว้นแต่ครูระบุข้อความให้แสดงในภาพ",
      `คำขอจากครู: ${prompt}`,
    ].join("\n\n");
    const generatedImage = mode === "image" ? await generateWorksheetImage(imagePrompt, imageReferences) : undefined;
    const replyText = generatedImage
      ? "สร้างภาพประกอบใบงานให้แล้ว ดาวน์โหลดหรือบันทึกภาพจากตัวอย่างด้านล่างได้เลย ภาพนี้แสดงเฉพาะในหน้าสนทนาปัจจุบันและไม่บันทึกลงประวัติข้อความ"
      : await generateWithGemini([
        ...history.map((item) => ({ role: item.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: item.content }] })),
        { role: "user", parts: [{ text: prompt }, ...fileParts] },
      ], { teacherProfile, teacherMemory: memoryContext, worksheet: mode === "worksheet" });

    const [, reply] = await prisma.$transaction(async (transaction) => {
      const userMessage = await transaction.aiChatMessage.create({ data: { sessionId, role: "user", content: savedContent } });
      const savedReply = await transaction.aiChatMessage.create({ data: { sessionId, role: "assistant", content: replyText } });
      await transaction.aiChatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date(), ...(history.length === 0 ? { title: (content || filenames[0] || "ไฟล์แนบ").slice(0, 60) } : {}) } });
      if ((memory?.enabled ?? true) && nextPreferences.length !== preferences.length) {
        await transaction.teacherAiMemory.upsert({
          where: { ownerId },
          create: { ownerId, preferences: JSON.stringify(nextPreferences) },
          update: { preferences: JSON.stringify(nextPreferences) },
        });
      }
      return [userMessage, savedReply] as const;
    });

    return Response.json({
      reply: { id: reply.id, role: reply.role, content: reply.content, created_at: reply.createdAt.toISOString() },
      ...(generatedImage ? { image: generatedImage } : {}),
    }, { status: 201 });
  } catch (error) { return aiErrorResponse(error); }
}
