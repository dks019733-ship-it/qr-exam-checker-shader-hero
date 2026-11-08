import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleFormsAccessToken, googleFormsRequest, GoogleFormsAPIError } from "@/lib/google-forms";
import { getFormScoreColumnIds, getFormScoreDestination, getOtherFormScoreColumnIds } from "@/lib/gradebook-form-destination";
import { matchFormStudent } from "@/lib/google-form-student-match";

type FormItem = { itemId?: string; title?: string; questionItem?: { question?: { questionId?: string; grading?: { pointValue?: number } } } };
type FormInfo = { items?: FormItem[] };
type FormAnswer = { textAnswers?: { answers?: { value?: string }[] }; grade?: { score?: number } };
type FormResponse = { responseId?: string; lastSubmittedTime?: string; totalScore?: number; answers?: Record<string, FormAnswer> };
type ResponsePage = { responses?: FormResponse[]; nextPageToken?: string };

const normalized = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");
const normalizedLabel = (value: string) => normalized(value).replace(/[^\p{L}\p{N}]/gu, "");
const normalizedRoom = (value: string) => {
  const text = normalized(value).replace(/^(?:ห้อง|ชั้น|มัธยมศึกษาปีที่|มัธยมศึกษา|ม\.?)*/u, "");
  const match = text.match(/(\d+)\s*[/.-]\s*(\d+)/u);
  return match ? `${Number(match[1])}/${Number(match[2])}` : text.replace(/[.-]/g, "/");
};
function answerFor(response: FormResponse, questionId?: string, itemId?: string) {
  const answer = (questionId ? response.answers?.[questionId] : undefined)
    ?? (itemId ? response.answers?.[itemId] : undefined);
  return answer?.textAnswers?.answers?.map((entry) => entry.value || "").join(" ").trim() || "";
}
function responseScore(response: FormResponse, gradedQuestionIds: string[]) {
  if (typeof response.totalScore === "number" && Number.isFinite(response.totalScore)) return response.totalScore;
  if (!gradedQuestionIds.length) return null;
  const grades = gradedQuestionIds.map((questionId) => response.answers?.[questionId]?.grade?.score);
  if (grades.some((score) => typeof score !== "number" || !Number.isFinite(score))) return null;
  return (grades as number[]).reduce((total, score) => total + score, 0);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const column = await prisma.gradeColumn.findFirst({
    where: { id, ownerId: session.user.id, googleFormId: { not: null } },
    include: { googleForm: { select: { formId: true } }, classroom: { select: { id: true, name: true } } },
  });
  if (!column?.googleForm) return NextResponse.json({ error: "ช่องคะแนนนี้ไม่ได้เชื่อมกับ Google Form" }, { status: 404 });
  try {
    const token = await getGoogleFormsAccessToken(session.user.id, "responses");
    const form = await googleFormsRequest<FormInfo>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}`);
    const items = form.items || [];
    // Forms API answers are keyed by questionId, while each form item has a separate itemId.
    // Use questionId for question answers, falling back to itemId for older responses.
    const fieldIds = (labels: string[]) => {
      const expected = new Set(labels.map(normalizedLabel));
      const item = items.find((candidate) => expected.has(normalizedLabel(candidate.title || "")));
      return { questionId: item?.questionItem?.question?.questionId, itemId: item?.itemId };
    };
    const rollIds = fieldIds(["เลขที่", "ลำดับ", "เลขที่นักเรียน"]);
    const roomIds = fieldIds(["ห้อง", "ห้องเรียน", "ชั้น", "ชั้น/ห้อง", "ระดับชั้น/ห้อง"]);
    const nameIds = fieldIds(["ชื่อ-นามสกุล", "ชื่อสกุล", "ชื่อ-สกุล", "ชื่อนักเรียน", "ชื่อ"]);
    if (!(rollIds.questionId || rollIds.itemId) || !(roomIds.questionId || roomIds.itemId) || !(nameIds.questionId || nameIds.itemId)) return NextResponse.json({ error: "ฟอร์มนี้ต้องมีคำถามสำหรับเลขที่ ห้อง และชื่อ-นามสกุล (ใช้ชื่อช่องใกล้เคียงได้) กรุณาตรวจคำถามในฟอร์ม" }, { status: 400 });
    const maxFormScore = items.reduce((sum, item) => sum + Number(item.questionItem?.question?.grading?.pointValue || 0), 0);
    if (!maxFormScore) return NextResponse.json({ error: "ฟอร์มนี้ยังไม่มีคะแนนแบบทดสอบที่ระบบอ่านได้" }, { status: 400 });
    const gradedQuestionIds = items.flatMap((item) => {
      const question = item.questionItem?.question;
      return question?.questionId && Number(question.grading?.pointValue || 0) > 0 ? [question.questionId] : [];
    });
    // Keep the displayed full score aligned with the actual quiz before storing raw responses.
    await prisma.gradeColumn.update({ where: { id: column.id }, data: { maxScore: maxFormScore } });
    const [students, classrooms, savedReviews] = await Promise.all([
      prisma.student.findMany({ where: { class: { ownerId: session.user.id }, isActive: true }, include: { class: { select: { id: true, name: true } } } }),
      prisma.class.findMany({ where: { ownerId: session.user.id }, select: { id: true } }),
      prisma.formResponseReview.findMany({ where: { columnId: column.id }, select: { responseId: true, studentId: true, score: true } }),
    ]);
    const reviewByResponse = new Map(savedReviews.map((review) => [review.responseId, review]));
    const roster = students.map((student) => ({
      id: student.id,
      rollNo: student.rollNo,
      studentNo: student.studentNo,
      name: student.name,
      classId: student.class.id,
      className: student.class.name,
    }));
    const scoresByClass = new Map<string, Map<string, number>>();
    const pendingRows: { columnId: string; responseId: string; rollNo: string; studentName: string; room: string; manualReviewRequired: boolean; score: number; submittedAt: Date | null }[] = [];
    const matchedResponseIds: string[] = [];
    let skipped = 0;
    let ungraded = 0;
    let responsesSeen = 0;
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ pageSize: "500" });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await googleFormsRequest<ResponsePage>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}/responses?${query}`);
      for (const response of result.responses || []) {
        responsesSeen++;
        const savedReview = response.responseId ? reviewByResponse.get(response.responseId) : undefined;
        const score = savedReview?.score ?? responseScore(response, gradedQuestionIds);
        if (typeof score !== "number") { ungraded++; continue; }
        const room = normalized(answerFor(response, roomIds.questionId, roomIds.itemId));
        const roll = answerFor(response, rollIds.questionId, rollIds.itemId);
        const name = answerFor(response, nameIds.questionId, nameIds.itemId);
        const manuallyMatched = savedReview?.studentId ? roster.find((student) => student.id === savedReview.studentId) : undefined;
        const matchedStudent = manuallyMatched || matchFormStudent(roster, roll, room, name);
        if (matchedStudent) {
          const classScores = scoresByClass.get(matchedStudent.classId) || new Map<string, number>();
          classScores.set(matchedStudent.id, score);
          scoresByClass.set(matchedStudent.classId, classScores);
          if (response.responseId) matchedResponseIds.push(response.responseId);
        } else if (response.responseId) {
          pendingRows.push({ columnId: column.id, responseId: response.responseId, rollNo: roll, studentName: name || "ไม่ระบุชื่อในฟอร์ม", room, manualReviewRequired: !!room && normalizedRoom(room) !== normalizedRoom(column.classroom.name), score, submittedAt: response.lastSubmittedTime ? new Date(response.lastSubmittedTime) : null });
        } else skipped++;
      }
      pageToken = result.nextPageToken;
      if (!pageToken) break;
      if (page === 99) throw new Error("ผลตอบกลับเกินจำนวนที่ระบบนำเข้าได้ในครั้งเดียว");
    }
    for (let i = 0; i < pendingRows.length; i += 100) {
      await prisma.$transaction(pendingRows.slice(i, i + 100).map((row) => prisma.pendingFormScore.upsert({
        where: { columnId_responseId: { columnId: row.columnId, responseId: row.responseId } },
        create: row,
        update: { rollNo: row.rollNo, studentName: row.studentName, room: row.room, manualReviewRequired: row.manualReviewRequired, score: row.score, submittedAt: row.submittedAt },
      })));
    }
    if (matchedResponseIds.length) await prisma.pendingFormScore.deleteMany({ where: { columnId: column.id, responseId: { in: matchedResponseIds } } });
    const formColumnIds = await getFormScoreColumnIds(column.id);
    const matchedStudentIds = [...new Set([...scoresByClass.values()].flatMap((classScores) => [...classScores.keys()]))];
    const existingScores = await prisma.gradeScore.findMany({
      where: { columnId: { in: formColumnIds } },
      select: { studentId: true },
    });
    const matchedStudentIdSet = new Set(matchedStudentIds);
    const staleStudentIds = [...new Set(existingScores.map(({ studentId }) => studentId))]
      .filter((studentId) => !matchedStudentIdSet.has(studentId));
    for (let i = 0; i < staleStudentIds.length; i += 500) {
      await prisma.gradeScore.deleteMany({
        where: { columnId: { in: formColumnIds }, studentId: { in: staleStudentIds.slice(i, i + 500) } },
      });
    }
    let imported = 0;
    const destinations = new Map<string, string>();
    for (const classroom of classrooms) {
      destinations.set(classroom.id, await getFormScoreDestination({ ...column, maxScore: maxFormScore }, classroom.id));
    }
    for (const [classId, classScores] of scoresByClass) {
      const destinationColumnId = destinations.get(classId);
      if (!destinationColumnId) throw new Error("ไม่พบช่องคะแนนปลายทางของห้องเรียน");
      const staleColumnIds = await getOtherFormScoreColumnIds(column.id, destinationColumnId);
      const entries = [...classScores.entries()];
      imported += entries.length;
      for (let i = 0; i < entries.length; i += 25) {
        const batch = entries.slice(i, i + 25);
        await prisma.$transaction([
          ...(staleColumnIds.length ? [prisma.gradeScore.deleteMany({
            where: { columnId: { in: staleColumnIds }, studentId: { in: batch.map(([studentId]) => studentId) } },
          })] : []),
          ...batch.map(([studentId, score]) => prisma.gradeScore.upsert({
            where: { columnId_studentId: { columnId: destinationColumnId, studentId } },
            create: { columnId: destinationColumnId, studentId, score },
            update: { score },
          })),
        ]);
      }
    }
    return NextResponse.json({ imported, pending: pendingRows.length, skipped, ungraded, responsesSeen, maxFormScore, maxGradeScore: maxFormScore, scoreSource: "google_forms_raw" });
  } catch (error) {
    if (error instanceof GoogleFormsAPIError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "ซิงก์คะแนนไม่สำเร็จ";
    if (/บัญชี Google|สิทธิ์|Google OAuth/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
    console.error("[Gradebook] Google Forms sync failed", error);
    return NextResponse.json({ error: "ซิงก์คะแนน Google Forms ไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
