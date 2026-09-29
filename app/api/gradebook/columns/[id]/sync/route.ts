import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleFormsAccessToken, googleFormsRequest, GoogleFormsAPIError } from "@/lib/google-forms";

type FormItem = { itemId?: string; title?: string; questionItem?: { question?: { grading?: { pointValue?: number } } } };
type FormInfo = { items?: FormItem[] };
type FormAnswer = { textAnswers?: { answers?: { value?: string }[] } };
type FormResponse = { totalScore?: number; answers?: Record<string, FormAnswer> };
type ResponsePage = { responses?: FormResponse[]; nextPageToken?: string };

const normalized = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");
function answerFor(response: FormResponse, itemId?: string) {
  return itemId ? response.answers?.[itemId]?.textAnswers?.answers?.map((answer) => answer.value || "").join(" ").trim() || "" : "";
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const column = await prisma.gradeColumn.findFirst({
    where: { id, ownerId: session.user.id, googleFormId: { not: null } },
    include: { googleForm: { select: { formId: true } }, classroom: { select: { id: true, name: true } } },
  });
  if (!column?.googleForm) return NextResponse.json({ error: "ช่องคะแนนนี้ไม่ได้เชื่อมกับ Google Form" }, { status: 404 });
  try {
    const token = await getGoogleFormsAccessToken(session.user.id);
    const form = await googleFormsRequest<FormInfo>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}`);
    const items = form.items || [];
    const fieldId = (label: string) => items.find((item) => normalized(item.title || "") === normalized(label))?.itemId;
    const rollId = fieldId("เลขที่");
    const roomId = fieldId("ห้อง");
    const nameId = fieldId("ชื่อ-นามสกุล");
    if (!rollId || !roomId || !nameId) return NextResponse.json({ error: "ฟอร์มนี้ไม่มีช่อง เลขที่/ห้อง/ชื่อ-นามสกุล ตามที่ระบบใช้จับคู่ กรุณาสร้างฟอร์มจากระบบนี้" }, { status: 400 });
    const maxFormScore = items.reduce((sum, item) => sum + Number(item.questionItem?.question?.grading?.pointValue || 0), 0);
    if (!maxFormScore) return NextResponse.json({ error: "ฟอร์มนี้ยังไม่มีคะแนนแบบทดสอบที่ระบบอ่านได้" }, { status: 400 });
    const students = await prisma.student.findMany({ where: { classId: column.classId, isActive: true }, select: { id: true, rollNo: true, studentNo: true, name: true } });
    const roster = students.map((student) => ({ ...student, nameKey: normalized(student.name), rolls: [normalized(student.rollNo), normalized(student.studentNo)].filter(Boolean) }));
    const scores = new Map<string, number>();
    let skipped = 0;
    let ungraded = 0;
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ pageSize: "500" });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await googleFormsRequest<ResponsePage>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}/responses?${query}`);
      for (const response of result.responses || []) {
        const score = response.totalScore;
        if (typeof score !== "number") { ungraded++; continue; }
        const room = normalized(answerFor(response, roomId));
        if (room && room !== normalized(column.classroom.name)) { skipped++; continue; }
        const roll = normalized(answerFor(response, rollId));
        const name = normalized(answerFor(response, nameId));
        if (!name) { skipped++; continue; }
        const candidates = roster.filter((student) => (roll ? student.rolls.includes(roll) : true) && student.nameKey === name);
        if (candidates.length !== 1) { skipped++; continue; }
        scores.set(candidates[0].id, Math.min(column.maxScore, Math.max(0, (score / maxFormScore) * column.maxScore)));
      }
      pageToken = result.nextPageToken;
      if (!pageToken) break;
      if (page === 99) throw new Error("ผลตอบกลับเกินจำนวนที่ระบบนำเข้าได้ในครั้งเดียว");
    }
    const entries = [...scores.entries()];
    for (let i = 0; i < entries.length; i += 25) {
      await Promise.all(entries.slice(i, i + 25).map(([studentId, score]) => prisma.gradeScore.upsert({
        where: { columnId_studentId: { columnId: column.id, studentId } },
        create: { columnId: column.id, studentId, score },
        update: { score },
      })));
    }
    return NextResponse.json({ imported: entries.length, skipped, ungraded, maxFormScore, maxGradeScore: column.maxScore });
  } catch (error) {
    if (error instanceof GoogleFormsAPIError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "ซิงก์คะแนนไม่สำเร็จ";
    if (/บัญชี Google|สิทธิ์|Google OAuth/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
    console.error("[Gradebook] Google Forms sync failed", error);
    return NextResponse.json({ error: "ซิงก์คะแนน Google Forms ไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
