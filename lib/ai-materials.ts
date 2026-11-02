import { AIRequestError, generateWithGemini } from "@/lib/ai-server";

export type MaterialKind = "exam" | "document";
export type MaterialStatus = "pending_review" | "approved";

export interface ExamQuestion {
  number: number;
  type: string;
  prompt: string;
  choices?: string[];
  answer: string;
  rationale?: string;
  points: number;
}

export interface MaterialContent {
  overview?: string;
  instructions?: string;
  worksheetStyle?: "cute" | "editable";
  learningObjectives?: string[];
  totalPoints?: number;
  questions?: ExamQuestion[];
  sections?: { heading: string; body: string; items?: string[]; responseLines?: number }[];
}

export interface GenerateMaterialInput {
  kind: MaterialKind;
  subject: string;
  gradeLevel: string;
  topic: string;
  learningObjectives?: string;
  questionCount?: number;
  questionTypes?: string[];
  difficulty?: string;
  documentType?: string;
  worksheetStyle?: "cute" | "editable";
}

export function normalizeContent(kind: MaterialKind, value: unknown): MaterialContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AIRequestError("เนื้อหาที่สร้างไม่ถูกต้อง กรุณาลองใหม่", 502);
  const raw = value as Record<string, any>;
  const content: MaterialContent = {
    overview: typeof raw.overview === "string" ? raw.overview.slice(0, 12000) : "",
    learningObjectives: Array.isArray(raw.learningObjectives) ? raw.learningObjectives.filter((item: unknown): item is string => typeof item === "string").slice(0, 30).map((item: string) => item.slice(0, 1000)) : [],
  };
  if (raw.worksheetStyle === "cute" || raw.worksheetStyle === "editable") content.worksheetStyle = raw.worksheetStyle;
  if (kind === "exam") {
    if (!Array.isArray(raw.questions) || raw.questions.length === 0 || raw.questions.length > 40) throw new AIRequestError("AI ไม่ได้สร้างรายการข้อสอบที่ถูกต้อง กรุณาลองใหม่", 502);
    content.instructions = typeof raw.instructions === "string" ? raw.instructions : "";
    content.questions = raw.questions.map((item: any, index: number) => {
      if (!item || typeof item.prompt !== "string" || !item.prompt.trim() || item.prompt.length > 5000 || typeof item.answer !== "string" || item.answer.length > 2000) throw new AIRequestError("AI สร้างคำถามหรือเฉลยไม่ครบ กรุณาลองใหม่", 502);
      return {
        number: Number.isInteger(Number(item.number)) ? Number(item.number) : index + 1,
        type: typeof item.type === "string" ? item.type : "คำถาม",
        prompt: item.prompt,
        choices: Array.isArray(item.choices) ? item.choices.filter((choice: unknown): choice is string => typeof choice === "string").slice(0, 10).map((choice: string) => choice.slice(0, 1000)) : [],
        answer: item.answer,
        rationale: typeof item.rationale === "string" ? item.rationale.slice(0, 5000) : "",
        points: 1,
      };
    });
    content.totalPoints = content.questions.length;
  } else {
    if (!Array.isArray(raw.sections) || raw.sections.length === 0 || raw.sections.length > 40) throw new AIRequestError("AI ไม่ได้สร้างส่วนเอกสารที่ถูกต้อง กรุณาลองใหม่", 502);
    content.instructions = typeof raw.instructions === "string" ? raw.instructions.slice(0, 4000) : "";
    content.sections = raw.sections.map((section: any) => {
      if (!section || typeof section.heading !== "string" || section.heading.length > 200 || typeof section.body !== "string" || section.body.length > 12000) throw new AIRequestError("AI สร้างหัวข้อหรือเนื้อหาเอกสารไม่ครบ กรุณาลองใหม่", 502);
      return {
        heading: section.heading,
        body: section.body,
        items: Array.isArray(section.items) ? section.items.filter((item: unknown): item is string => typeof item === "string").slice(0, 30).map((item: string) => item.slice(0, 2000)) : [],
        responseLines: Number.isInteger(section.responseLines) ? Math.min(12, Math.max(0, section.responseLines)) : 3,
      };
    });
  }
  return content;
}

export async function generateMaterialContent(input: GenerateMaterialInput) {
  if (!input || !["exam", "document"].includes(input.kind)) throw new AIRequestError("ประเภทชิ้นงานไม่ถูกต้อง", 400);
  for (const [label, value] of [["วิชา", input.subject], ["ระดับชั้น", input.gradeLevel], ["หัวข้อ", input.topic]] as const) {
    if (typeof value !== "string" || !value.trim() || value.length > 160) throw new AIRequestError(`กรุณากรอก${label} (ไม่เกิน 160 ตัวอักษร)`, 400);
  }
  if (input.learningObjectives !== undefined && (typeof input.learningObjectives !== "string" || input.learningObjectives.length > 3000)) throw new AIRequestError("ตัวชี้วัดหรือจุดประสงค์ไม่ถูกต้อง", 400);
  if (input.difficulty !== undefined && (typeof input.difficulty !== "string" || input.difficulty.length > 160)) throw new AIRequestError("รายละเอียดความยากไม่ถูกต้อง", 400);
  if (input.documentType !== undefined && (typeof input.documentType !== "string" || input.documentType.length > 100)) throw new AIRequestError("ประเภทเอกสารไม่ถูกต้อง", 400);
  if (input.worksheetStyle !== undefined && !["cute", "editable"].includes(input.worksheetStyle)) throw new AIRequestError("รูปแบบใบงานไม่ถูกต้อง", 400);
  if (input.kind === "exam" && (!Number.isInteger(input.questionCount ?? 10) || (input.questionCount ?? 10) < 1 || (input.questionCount ?? 10) > 40)) throw new AIRequestError("จำนวนข้อสอบต้องอยู่ระหว่าง 1 ถึง 40 ข้อ", 400);
  if (input.questionTypes !== undefined && (!Array.isArray(input.questionTypes) || input.questionTypes.length > 5 || input.questionTypes.some((type) => typeof type !== "string" || type.length > 50))) throw new AIRequestError("รูปแบบข้อสอบไม่ถูกต้อง", 400);
  const objectives = input.learningObjectives?.trim() || "ให้สอดคล้องกับหัวข้อและระดับชั้น";
  const documentStyle = input.documentType !== "ใบงาน"
    ? "เรียบง่าย เป็นระเบียบ ใช้สอนจริง"
    : input.worksheetStyle === "editable"
      ? "ทางการ เรียบง่าย พิมพ์แก้ไขต่อใน Word ได้"
      : "น่ารัก สดใส เหมาะกับนักเรียน โดยเว็บจะวางข้อความจริงและจัดหน้าเพื่อบันทึกเป็น PDF";
  const documentOutputShape = JSON.stringify({
    overview: "เป้าหมายสั้นๆ สำหรับครู/นักเรียน",
    instructions: "คำชี้แจงที่ใช้ได้จริง",
    learningObjectives: ["ผลการเรียนรู้ที่สังเกตได้"],
    sections: [{ heading: "ชื่อกิจกรรมที่ชัดเจน", body: "คำเกริ่นสั้นๆ หรือสตริงว่าง", items: ["โจทย์หรือสิ่งที่ให้นักเรียนทำ"], responseLines: 3 }],
    worksheetStyle: input.worksheetStyle === "editable" ? "editable" : "cute",
  });
  const documentPrompt = [
    `จัดทำ${input.documentType || "เอกสารประกอบการสอน"}ภาษาไทยสำหรับครู โดยออกแบบให้ครูนำไปใช้สอนจริง ไม่ใช่เรียงความหรือข้อความทั่วไป`,
    `วิชา: ${input.subject}`,
    `ระดับชั้น: ${input.gradeLevel}`,
    `หัวข้อ: ${input.topic}`,
    `ตัวชี้วัด/จุดประสงค์ที่ครูให้มา: ${objectives}`,
    `รูปแบบ${input.documentType === "ใบงาน" ? "ใบงาน" : "เอกสาร"}: ${documentStyle}`,
    `บริบทเพิ่มเติมจากครู: ${input.difficulty || "เหมาะกับระดับชั้น"}`,
    "",
    "หลักการจัดเนื้อหาแบบครู:",
    "- ตั้งชื่อใบงานและคำชี้แจงสั้น ชัดเจน ระบุสิ่งที่นักเรียนต้องทำ",
    "- เรียงกิจกรรมจากทบทวนความรู้ ไปสู่ฝึกทำ/ประยุกต์ และปิดท้ายสะท้อนความเข้าใจ โดยปรับให้เข้ากับหัวข้อนี้จริง",
    "- ใช้คำถาม/คำสั่งหลากหลายและตรงวัย หลีกเลี่ยงคำถามกว้างๆ ซ้ำกัน คำเกริ่นฟุ่มเฟือย หรือถ้อยคำบอกว่า AI สร้าง",
    "- ไม่แต่งตัวชี้วัด เลขมาตรฐาน ชื่อโรงเรียน หรือข้อเท็จจริงที่ครูไม่ได้ให้มา",
    "- แยกกิจกรรมแต่ละข้อเป็น item สั้นๆ ไม่ใส่เลขนำหน้าใน item เพราะหน้าใบงานจะเรียงเลขให้เอง และกำหนด responseLines 2-6 ตามพื้นที่เขียนที่ต้องใช้",
    "- ไม่ใส่เฉลยในใบงาน; เนื้อหาทุกส่วนต้องสอดคล้องกับวิชา ระดับชั้น และหัวข้อจริง",
    `ตอบ JSON เท่านั้น รูปแบบ ${documentOutputShape}`,
  ].join("\n");
  const prompt = input.kind === "exam"
    ? `สร้างข้อสอบภาษาไทยสำหรับครู โดยยึดข้อมูลนี้\nวิชา: ${input.subject}\nระดับชั้น: ${input.gradeLevel}\nหัวข้อ: ${input.topic}\nตัวชี้วัด/จุดประสงค์: ${objectives}\nจำนวนข้อ: ${input.questionCount ?? 10}\nรูปแบบข้อ: ${(input.questionTypes || ["ปรนัย", "อัตนัยสั้น"]).join(", ")}\nความยาก: ${input.difficulty || "ปานกลาง"}\nตอบเป็น JSON เท่านั้น ใช้รูปแบบ {"overview":"...","instructions":"...","learningObjectives":["..."],"questions":[{"number":1,"type":"ปรนัย","prompt":"...","choices":["ก. ...","ข. ...","ค. ...","ง. ..."],"answer":"...","rationale":"...","points":1}]}. ให้คะแนนทุกข้อข้อละ 1 คะแนน และระบุว่าเป็นร่างที่ครูต้องตรวจสอบก่อนใช้`
    : documentPrompt;
  const text = await generateWithGemini([{ role: "user", parts: [{ text: prompt }] }], { json: true, temperature: 0.35 });
  let parsed: unknown;
  try { parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new AIRequestError("AI สร้างเนื้อหาไม่เป็นรูปแบบที่ต้องการ กรุณาลองใหม่", 502); }
  const content = normalizeContent(input.kind, parsed);
  if (input.kind === "document" && input.documentType === "ใบงาน") {
    content.worksheetStyle = input.worksheetStyle || "cute";
  }
  if (input.kind === "exam" && content.questions?.length !== (input.questionCount ?? 10)) throw new AIRequestError("AI สร้างจำนวนข้อไม่ครบตามที่เลือก กรุณาลองใหม่", 502);
  return content;
}

export function toMaterialDto(material: any) {
  return {
    id: material.id,
    kind: material.kind,
    title: material.title,
    subject: material.subject,
    grade_level: material.gradeLevel,
    topic: material.topic,
    learning_objectives: material.learningObjectives,
    document_type: material.documentType,
    content: material.content,
    status: material.status,
    review_notes: material.reviewNotes,
    google_form: material.googleForm ? {
      form_id: material.googleForm.formId,
      edit_url: material.googleForm.editUrl,
      responder_url: material.googleForm.responderUrl,
    } : null,
    created_at: material.createdAt.toISOString(),
    updated_at: material.updatedAt.toISOString(),
  };
}
