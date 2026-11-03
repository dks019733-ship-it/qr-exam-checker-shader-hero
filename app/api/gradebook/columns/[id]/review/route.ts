import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleFormsAccessToken, googleFormsRequest, GoogleFormsAccessError, GoogleFormsAPIError } from "@/lib/google-forms";
import { getFormScoreColumnIds, getFormScoreDestination, getOtherFormScoreColumnIds } from "@/lib/gradebook-form-destination";
import { compareFormStudents, matchFormStudent } from "@/lib/google-form-student-match";

type FormItem = {
  itemId?: string;
  title?: string;
  questionItem?: {
    question?: {
      questionId?: string;
      grading?: { pointValue?: number; correctAnswers?: { answers?: { value?: string }[] } };
      choiceQuestion?: { options?: { value?: string }[] };
    };
  };
};
type FormInfo = { info?: { title?: string }; items?: FormItem[] };
type FormAnswer = { textAnswers?: { answers?: { value?: string }[] }; grade?: { score?: number } };
type FormResponse = { responseId?: string; lastSubmittedTime?: string; totalScore?: number; answers?: Record<string, FormAnswer> };
type ResponsePage = { responses?: FormResponse[]; nextPageToken?: string };

const normalized = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");
const answerText = (answer?: FormAnswer) => answer?.textAnswers?.answers?.map((entry) => entry.value || "").join(" · ") || "";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const column = await prisma.gradeColumn.findFirst({
    where: { id, ownerId: session.user.id, googleFormId: { not: null } },
    include: { googleForm: { select: { formId: true } }, classroom: { select: { id: true, name: true } } },
  });
  if (!column?.googleForm) return NextResponse.json({ error: "ไม่พบช่องคะแนน Google Forms" }, { status: 404 });

  try {
    const token = await getGoogleFormsAccessToken(session.user.id, "responses");
    const form = await googleFormsRequest<FormInfo>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}`);
    const questions = (form.items || []).flatMap((item) => {
      const question = item.questionItem?.question;
      if (!question?.questionId || !question.grading || Number(question.grading.pointValue || 0) <= 0) return [];
      return [{
        id: question.questionId,
        title: item.title || "คำถาม",
        points: Number(question.grading.pointValue || 0),
        correctAnswers: (question.grading.correctAnswers?.answers || []).map((answer) => answer.value || ""),
        choices: (question.choiceQuestion?.options || []).map((option) => option.value || ""),
      }];
    });
    const [students, savedReviews, pendingScores] = await Promise.all([
      prisma.student.findMany({ where: { class: { ownerId: session.user.id }, isActive: true }, include: { class: { select: { id: true, name: true } } } }),
      prisma.formResponseReview.findMany({ where: { columnId: id }, select: { responseId: true, studentId: true, score: true, questionScores: true } }),
      prisma.pendingFormScore.findMany({ where: { columnId: id }, select: { responseId: true, rollNo: true, studentName: true, room: true, manualReviewRequired: true, score: true } }),
    ]);
    const savedByResponse = new Map(savedReviews.map((review) => [review.responseId, review]));
    const pendingByResponse = new Map(pendingScores.map((item) => [item.responseId, item]));
    const roster = students.map((student) => ({
      ...student,
      classId: student.class.id,
      className: student.class.name,
    }));

    const responses: FormResponse[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ pageSize: "500" });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await googleFormsRequest<ResponsePage>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}/responses?${query}`);
      responses.push(...(result.responses || []));
      pageToken = result.nextPageToken;
      if (!pageToken) break;
      if (page === 99) throw new Error("จำนวนคำตอบเกินขีดจำกัดที่ระบบเปิดตรวจได้ในครั้งเดียว");
    }

    const entries = responses.flatMap((response) => {
      if (!response.responseId) return [];
      const saved = savedByResponse.get(response.responseId);
      const pending = pendingByResponse.get(response.responseId);
      const formAnswers = response.answers || {};
      const answerForTitle = (labels: string[]) => {
        const labelSet = new Set(labels.map(normalized));
        const item = (form.items || []).find((candidate) => labelSet.has(normalized(candidate.title || "")));
        const questionId = item?.questionItem?.question?.questionId;
        return answerText(questionId ? formAnswers[questionId] : undefined);
      };
      const rollNo = answerForTitle(["เลขที่", "ลำดับ", "เลขที่นักเรียน"]) || pending?.rollNo || "";
      const room = answerForTitle(["ห้อง", "ห้องเรียน", "ชั้น", "ชั้น/ห้อง", "ระดับชั้น/ห้อง"]) || pending?.room || "";
      const studentName = answerForTitle(["ชื่อ-นามสกุล", "ชื่อสกุล", "ชื่อ-สกุล", "ชื่อนักเรียน", "ชื่อ"]) || pending?.studentName || "";
      const matchedStudent = saved?.studentId
        ? roster.find((student) => student.id === saved.studentId)
        : matchFormStudent(roster, rollNo, room, studentName);
      const storedQuestionScores = saved?.questionScores && typeof saved.questionScores === "object" && !Array.isArray(saved.questionScores)
        ? saved.questionScores as Record<string, number>
        : {};
      const questionRows = questions.map((question) => ({
        ...question,
        answer: answerText(formAnswers[question.id]) || "—",
        score: typeof storedQuestionScores[question.id] === "number"
          ? storedQuestionScores[question.id]
          : typeof formAnswers[question.id]?.grade?.score === "number"
            ? formAnswers[question.id]!.grade!.score!
            : 0,
      }));
      const autoScore = typeof response.totalScore === "number"
        ? response.totalScore
        : questionRows.reduce((total, question) => total + question.score, 0);
      return [{
        responseId: response.responseId,
        submittedAt: response.lastSubmittedTime || null,
        rollNo,
        formRoom: room,
        room: matchedStudent?.className || room,
        manualReviewRequired: pending?.manualReviewRequired || false,
        studentName,
        studentId: matchedStudent?.id || null,
        matchedStudent: matchedStudent ? { rollNo: matchedStudent.rollNo || matchedStudent.studentNo, studentNo: matchedStudent.studentNo, name: matchedStudent.name, className: matchedStudent.className } : null,
        score: saved?.score ?? pending?.score ?? autoScore,
        questionScores: Object.fromEntries(questionRows.map((question) => [question.id, question.score])),
        answers: questionRows,
      }];
    });
    entries.sort((a, b) => {
      const byRoom = (a.room || "").localeCompare(b.room || "", "th", { numeric: true });
      if (byRoom) return byRoom;
      if (a.studentId && b.studentId) return compareFormStudents(
        roster.find((student) => student.id === a.studentId)!,
        roster.find((student) => student.id === b.studentId)!,
      );
      if (a.studentId) return -1;
      if (b.studentId) return 1;
      return (a.rollNo || "").localeCompare(b.rollNo || "", "th", { numeric: true }) || (a.studentName || "").localeCompare(b.studentName || "", "th");
    });
    return NextResponse.json({
      column: { id: column.id, title: column.title, className: column.classroom.name, maxScore: column.maxScore, formId: column.googleForm.formId },
      questions,
      students: roster.map(({ id, rollNo, studentNo, name, className }) => ({ id, rollNo: rollNo || studentNo, studentNo, name, className })).sort(compareFormStudents),
      responses: entries,
    });
  } catch (error) {
    if (error instanceof GoogleFormsAccessError) return NextResponse.json({ error: error.message, action: "reauthorize" }, { status: 403 });
    if (error instanceof GoogleFormsAPIError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[Gradebook] Google Forms review load failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "โหลดคำตอบจาก Google Forms ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const responseId = typeof body?.responseId === "string" ? body.responseId : "";
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const rawScores = body?.questionScores;
  if (!responseId || !studentId || !rawScores || typeof rawScores !== "object" || Array.isArray(rawScores)) {
    return NextResponse.json({ error: "กรุณาเลือกนักเรียนและตรวจคะแนนรายข้อก่อนบันทึก" }, { status: 400 });
  }
  const column = await prisma.gradeColumn.findFirst({
    where: { id, ownerId: session.user.id, googleFormId: { not: null } },
    include: { googleForm: { select: { formId: true } } },
  });
  if (!column?.googleForm) return NextResponse.json({ error: "ไม่พบช่องคะแนน Google Forms" }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, class: { ownerId: session.user.id }, isActive: true }, select: { id: true, classId: true } });
  if (!student) return NextResponse.json({ error: "ไม่พบนักเรียนในห้องเรียนของครู" }, { status: 400 });

  try {
    const token = await getGoogleFormsAccessToken(session.user.id, "responses");
    const form = await googleFormsRequest<FormInfo>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}`);
    await googleFormsRequest<FormResponse>(token, `/forms/${encodeURIComponent(column.googleForm.formId)}/responses/${encodeURIComponent(responseId)}`);
    const validQuestions = new Map((form.items || []).flatMap((item) => {
      const question = item.questionItem?.question;
      return question?.questionId && Number(question.grading?.pointValue || 0) > 0
        ? [[question.questionId, Number(question.grading?.pointValue || 0)] as const]
        : [];
    }));
    let total = 0;
    const questionScores: Record<string, number> = {};
    for (const [questionId, rawScore] of Object.entries(rawScores as Record<string, unknown>)) {
      const max = validQuestions.get(questionId);
      const score = Number(rawScore);
      if (max === undefined || !Number.isFinite(score) || score < 0 || score > max) {
        return NextResponse.json({ error: "คะแนนรายข้อไม่ถูกต้อง กรุณาตรวจคะแนนอีกครั้ง" }, { status: 400 });
      }
      questionScores[questionId] = score;
      total += score;
    }
    if (!Object.keys(questionScores).length) return NextResponse.json({ error: "ไม่พบคะแนนรายข้อที่บันทึกได้" }, { status: 400 });
    const maxScore = [...validQuestions.values()].reduce((sum, points) => sum + points, 0);
    const destinationColumnId = await getFormScoreDestination({ ...column, maxScore }, student.classId);
    const staleColumnIds = await getOtherFormScoreColumnIds(column.id, destinationColumnId);
    const previousReview = await prisma.formResponseReview.findUnique({
      where: { columnId_responseId: { columnId: id, responseId } },
      select: { studentId: true },
    });

    await prisma.$transaction([
      ...(previousReview?.studentId && previousReview.studentId !== studentId ? [prisma.gradeScore.deleteMany({
        where: {
          columnId: { in: await getFormScoreColumnIds(column.id) },
          studentId: previousReview.studentId,
        },
      })] : []),
      ...(staleColumnIds.length ? [prisma.gradeScore.deleteMany({
        where: { columnId: { in: staleColumnIds }, studentId },
      })] : []),
      prisma.gradeColumn.update({ where: { id }, data: { maxScore } }),
      prisma.formResponseReview.upsert({
        where: { columnId_responseId: { columnId: id, responseId } },
        create: { columnId: id, responseId, studentId, score: total, questionScores },
        update: { studentId, score: total, questionScores },
      }),
      prisma.gradeScore.upsert({
        where: { columnId_studentId: { columnId: destinationColumnId, studentId } },
        create: { columnId: destinationColumnId, studentId, score: total },
        update: { score: total },
      }),
      prisma.pendingFormScore.deleteMany({ where: { columnId: id, responseId } }),
    ]);
    return NextResponse.json({ ok: true, score: total });
  } catch (error) {
    if (error instanceof GoogleFormsAccessError) return NextResponse.json({ error: error.message, action: "reauthorize" }, { status: 403 });
    if (error instanceof GoogleFormsAPIError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[Gradebook] Google Forms review save failed", error);
    return NextResponse.json({ error: "บันทึกคะแนนตรวจทานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
