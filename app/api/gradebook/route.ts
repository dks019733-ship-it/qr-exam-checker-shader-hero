import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const periods = ["MIDTERM", "AFTER_MIDTERM"] as const;

export async function GET(request: Request) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = session.user.id;
  const classId = new URL(request.url).searchParams.get("classId");
  const [classes, exams, googleForms] = await Promise.all([
    prisma.class.findMany({ where: { ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.exam.findMany({ where: { ownerId, ...(classId ? { classId } : {}) }, select: { id: true, title: true, subject: true, classId: true, gradeColumn: { select: { id: true } }, _count: { select: { questions: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.googleForm.findMany({ where: { ownerId }, include: { material: { select: { title: true, subject: true } }, gradeColumn: { select: { id: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!classId) return NextResponse.json({ classes, exams, googleForms });
  const classroom = classes.find((item) => item.id === classId);
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });
  const [students, columns, matchingStudents, teachingAssignments] = await Promise.all([
    prisma.student.findMany({ where: { classId, isActive: true }, select: { id: true, rollNo: true, studentNo: true, name: true } }),
    prisma.gradeColumn.findMany({
      where: { ownerId, classId },
      include: {
        scores: true,
        pendingFormScores: { orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }] },
        exam: { select: { title: true } },
        googleForm: { include: { material: { select: { title: true } } } },
        teachingAssignment: { include: { subject: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.student.findMany({
      where: { class: { ownerId }, isActive: true },
      include: { class: { select: { name: true } } },
      orderBy: [{ class: { name: "asc" } }],
    }),
    prisma.teachingAssignment.findMany({
      where: { ownerId, classId },
      include: { subject: { select: { id: true, code: true, name: true } }, classroom: { select: { id: true, name: true } } },
      orderBy: { subject: { code: "asc" } },
    }),
  ]);
  const byRollNo = (a: { rollNo: string; studentNo: string }, b: { rollNo: string; studentNo: string }) =>
    (a.rollNo || "").localeCompare(b.rollNo || "", "th", { numeric: true }) ||
    a.studentNo.localeCompare(b.studentNo, "th", { numeric: true });
  students.sort(byRollNo);
  const sortedMatchingStudents = [...matchingStudents].sort((a, b) =>
    a.class.name.localeCompare(b.class.name, "th", { numeric: true }) || byRollNo(a, b),
  );
  return NextResponse.json({
    classes,
    classroom,
    students,
    matchingStudents: sortedMatchingStudents.map(({ id, rollNo, studentNo, name, class: studentClass }) => ({ id, rollNo, studentNo, name, className: studentClass.name })),
    columns,
    exams,
    googleForms,
    teachingAssignments,
  });
}

export async function POST(request: Request) {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = session.user.id;
  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const period = body?.period;
  const rawMaxScore = body?.maxScore;
  const maxScore = typeof rawMaxScore === "number" ||
    (typeof rawMaxScore === "string" && rawMaxScore.trim() !== "")
    ? Number(rawMaxScore)
    : Number.NaN;
  const sourceType = body?.sourceType;
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId.trim() : "";
  const rawAssignmentId = body?.teachingAssignmentId;
  if (rawAssignmentId !== undefined && rawAssignmentId !== null && typeof rawAssignmentId !== "string") {
    return NextResponse.json({ error: "รหัสรายวิชาไม่ถูกต้อง" }, { status: 400 });
  }
  const requestedAssignmentId = typeof rawAssignmentId === "string" ? rawAssignmentId.trim() : "";
  if (!classId || !title || title.length > 120 || !periods.includes(period) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return NextResponse.json({ error: "กรุณากรอกชื่องาน ช่วงคะแนน และคะแนนเต็มให้ถูกต้อง" }, { status: 400 });
  }
  const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId }, select: { id: true } });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  let examId: string | undefined;
  let googleFormId: string | undefined;
  let googleFormResponderUrl = "";
  let importScores: { studentId: string; score: number }[] = [];
  let inheritedAssignmentId = "";
  if (sourceType === "exam") {
    const exam = await prisma.exam.findFirst({
      where: { id: sourceId, ownerId, classId },
      include: {
        _count: { select: { questions: true } },
        attempts: { where: { score: { not: null }, status: "CONFIRMED" }, select: { studentId: true, score: true } },
        gradeColumn: { select: { id: true } },
        teachingAssignment: { select: { id: true, classId: true, ownerId: true } },
      },
    });
    if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบในห้องนี้" }, { status: 404 });
    if (exam.gradeColumn) return NextResponse.json({ error: "ข้อสอบนี้เชื่อมกับสมุดคะแนนแล้ว" }, { status: 409 });
    if (exam.teachingAssignment &&
      (exam.teachingAssignment.ownerId !== ownerId || exam.teachingAssignment.classId !== classId)) {
      return NextResponse.json({ error: "รายวิชาที่ผูกกับข้อสอบไม่ตรงกับห้องเรียนหรือผู้สอน" }, { status: 409 });
    }
    inheritedAssignmentId = exam.teachingAssignment?.id || "";
    if (requestedAssignmentId && inheritedAssignmentId && requestedAssignmentId !== inheritedAssignmentId) {
      return NextResponse.json({ error: "รายวิชาที่เลือกไม่ตรงกับรายวิชาที่ผูกไว้กับข้อสอบ" }, { status: 400 });
    }
    examId = exam.id;
    importScores = exam._count.questions > 0 ? exam.attempts.flatMap((attempt) => attempt.score == null ? [] : [{ studentId: attempt.studentId, score: Math.min(maxScore, (attempt.score / exam._count.questions) * maxScore) }]) : [];
  } else if (sourceType === "google_form") {
    const form = await prisma.googleForm.findFirst({ where: { id: sourceId, ownerId }, select: { id: true, responderUrl: true, gradeColumn: { select: { id: true } } } });
    if (!form) return NextResponse.json({ error: "ไม่พบ Google Form" }, { status: 404 });
    if (form.gradeColumn) return NextResponse.json({ error: "Google Form นี้เชื่อมกับสมุดคะแนนแล้ว" }, { status: 409 });
    googleFormId = form.id;
    googleFormResponderUrl = form.responderUrl;
  } else if (sourceType !== "manual") {
    return NextResponse.json({ error: "แหล่งคะแนนไม่ถูกต้อง" }, { status: 400 });
  }

  const teachingAssignmentId = requestedAssignmentId || inheritedAssignmentId || null;
  // Every coursework column must have a teaching subject so it can become a managed task.
  // Exam result columns remain exam-only and are intentionally not published as assignments.
  if (!examId && !teachingAssignmentId) {
    return NextResponse.json({ error: "กรุณาเพิ่มและเลือกรายวิชาที่สอนก่อนสร้างงาน เพื่อให้ซิงก์ไปหน้ามอบหมายและหน้านักเรียนได้ครบ" }, { status: 400 });
  }
  if (sourceType === "google_form" && !googleFormResponderUrl) {
    return NextResponse.json({ error: "ไม่พบลิงก์สำหรับให้นักเรียนเปิด Google Forms" }, { status: 409 });
  }
  const anyAssignmentInClass = await prisma.teachingAssignment.findFirst({
    where: { ownerId, classId },
    select: { id: true },
  });
  if (anyAssignmentInClass && !teachingAssignmentId) {
    return NextResponse.json({ error: "กรุณาเลือกรายวิชาที่สอนก่อนบันทึกช่องคะแนน" }, { status: 400 });
  }
  if (teachingAssignmentId) {
    const assignment = await prisma.teachingAssignment.findFirst({
      where: { id: teachingAssignmentId, ownerId, classId },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "รายวิชาไม่ได้อยู่ในห้องเรียนนี้หรือไม่มีสิทธิ์" }, { status: 404 });
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      // The online gradebook is the source of truth: create the matching published
      // assignment and link it to the grade column in the same transaction.
      // Exam-linked columns are assessment results, not student coursework tasks.
      const assignment = !examId
        ? await tx.assignment.create({
            data: {
              ownerId,
              classId,
              teachingAssignmentId: teachingAssignmentId!,
              title,
              description: googleFormId
                ? "ทำแบบฝึกหัด/แบบทดสอบออนไลน์ผ่าน Google Forms"
                : "งานเก็บคะแนนในชั้นเรียน",
              mode: googleFormId ? "GOOGLE_FORM" : "TEACHER_CHECK",
              status: "PUBLISHED",
              googleFormUrl: googleFormId ? googleFormResponderUrl : null,
              maxScore,
            },
            select: { id: true },
          })
        : null;

      const column = await tx.gradeColumn.create({
        data: {
          ownerId, classId, title, period, maxScore,
          ...(teachingAssignmentId ? { teachingAssignmentId } : {}),
          ...(examId ? { examId } : {}),
          ...(googleFormId ? { googleFormId } : {}),
          ...(assignment ? { assignmentId: assignment.id } : {}),
          ...(importScores.length ? { scores: { create: importScores } } : {}),
        },
      });
      return { column, assignment };
    });

    return NextResponse.json({
      ...created.column,
      taskSynced: Boolean(created.assignment),
      assignmentId: created.assignment?.id ?? null,
    }, { status: 201 });
  } catch (error) {
    console.error("[Gradebook] create column and synced task failed", error);
    return NextResponse.json({ error: "เพิ่มงานในสมุดออนไลน์ไม่สำเร็จ ระบบไม่สามารถซิงก์งานไปหน้ามอบหมายได้" }, { status: 409 });
  }
}
