import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyStudentToken } from "@/lib/student-token";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("student_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    }

    const payload = verifyStudentToken(token);
    if (!payload?.studentId) {
      return NextResponse.json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { id: payload.studentId, isActive: true },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            owner: { select: { id: true, name: true, defaultLearningArea: true } },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียน" }, { status: 404 });
    }

    // Fetch all grade columns in this class with related exam, Google Form, and teaching assignments
    const [columns, classTeachingAssignments] = await Promise.all([
      prisma.gradeColumn.findMany({
      where: { classId: student.classId, ownerId: student.class.owner.id },
      include: {
        exam: {
          select: { id: true, title: true, subject: true, _count: { select: { questions: true } } },
        },
        googleForm: {
          select: {
            id: true,
            responderUrl: true,
            material: {
              select: { title: true, subject: true, topic: true },
            },
          },
        },
        teachingAssignment: {
          include: {
            subject: { select: { code: true, name: true } },
            owner: { select: { name: true } },
          },
        },
        scores: {
          where: { studentId: student.id },
          select: { score: true },
        },
      },
      orderBy: [{ period: "asc" }, { createdAt: "desc" }],
      }),
      prisma.teachingAssignment.findMany({
        where: { classId: student.classId, ownerId: student.class.owner.id },
        include: {
          subject: { select: { id: true, code: true, name: true } },
          owner: { select: { name: true } },
        },
      }),
    ]);

    const resolveTeachingAssignment = (column: (typeof columns)[number]) => {
      if (column.teachingAssignment) return column.teachingAssignment;
      const legacySubject = (column.exam?.subject || column.googleForm?.material?.subject || "").trim().toLocaleLowerCase("th-TH");
      if (!legacySubject) return null;
      const matches = classTeachingAssignments.filter((assignment) =>
        [assignment.subject.code, assignment.subject.name]
          .some((value) => value.trim().toLocaleLowerCase("th-TH") === legacySubject),
      );
      return matches.length === 1 ? matches[0] : null;
    };

    const teacherDefault = student.class.owner?.name || "ครูผู้สอน";

    // Map each column to an assignment task
    const assignments = columns.map((col) => {
      const studentScore = col.scores[0]?.score ?? null;
      const isSubmitted = studentScore !== null;

      const teachingAssignment = resolveTeachingAssignment(col);
      const subjectName =
        teachingAssignment?.subject?.name ||
        col.exam?.subject ||
        col.googleForm?.material?.subject ||
        "วิชาทั่วไป";
      const subjectCode = teachingAssignment?.subject?.code || "";
      const subjectLabel = subjectCode ? `${subjectCode} · ${subjectName}` : subjectName;

      const teacherName =
        teachingAssignment?.owner?.name ||
        student.class.owner?.name ||
        "ครูประจำวิชา";

      let taskType = "ใบงาน";
      let actionUrl: string | null = null;
      let desc = "งานเก็บคะแนนในชั้นเรียน";

      if (col.googleForm?.responderUrl) {
        taskType = "Google Form";
        actionUrl = col.googleForm.responderUrl;
        desc = "ทำแบบฝึกหัด/แบบทดสอบออนไลน์ผ่าน Google Forms";
      } else if (col.examId) {
        taskType = "แบบทดสอบ";
        desc = `แบบทดสอบวัดผลในชั้นเรียน ${col.exam?._count?.questions ? `(${col.exam._count.questions} ข้อ)` : ""}`;
      }

      const periodLabel = col.period === "MIDTERM" ? "กลางภาค" : "หลังกลางภาค";

      return {
        id: col.id,
        subject: subjectLabel,
        teacher: teacherName,
        title: col.title,
        dueDate: periodLabel,
        status: isSubmitted ? ("submitted" as const) : ("pending" as const),
        score: isSubmitted ? `${studentScore}/${col.maxScore}` : undefined,
        rawScore: studentScore,
        maxScore: col.maxScore,
        points: `${col.maxScore} คะแนน`,
        type: taskType,
        priority: isSubmitted ? ("low" as const) : ("high" as const),
        desc,
        actionUrl,
        period: col.period,
        createdAt: col.createdAt.toISOString(),
      };
    });

    // Group columns by subject to produce the scores summary table
    const subjectMap = new Map<
      string,
      {
        subject: string;
        teacher: string;
        courseworkScore: number;
        courseworkMax: number;
        midtermExamScore: number;
        midtermExamMax: number;
      }
    >();

    for (const col of columns) {
      const teachingAssignment = resolveTeachingAssignment(col);
      const subjectName =
        teachingAssignment?.subject?.name ||
        col.exam?.subject ||
        col.googleForm?.material?.subject ||
        "วิชาทั่วไป";
      const subjectCode = teachingAssignment?.subject?.code || "";
      const subjectLabel = subjectCode ? `${subjectCode} · ${subjectName}` : subjectName;
      const subjectKey = teachingAssignment?.id || (subjectCode ? `${subjectCode}:${subjectName}` : subjectName);

      const teacherName =
        teachingAssignment?.owner?.name || teacherDefault;

      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          subject: subjectLabel,
          teacher: teacherName,
          courseworkScore: 0,
          courseworkMax: 0,
          midtermExamScore: 0,
          midtermExamMax: 0,
        });
      }

      const entry = subjectMap.get(subjectKey)!;
      const score = col.scores[0]?.score ?? 0;

      if (col.period === "MIDTERM") {
        // Preserve legacy MIDTERM columns as a separate exam score.
        entry.midtermExamScore += score;
        entry.midtermExamMax += col.maxScore;
      } else {
        // BEFORE_MIDTERM and AFTER_MIDTERM are both coursework periods.
        entry.courseworkScore += score;
        entry.courseworkMax += col.maxScore;
      }
    }

    const scores = Array.from(subjectMap.values()).map((item) => {
      const totalScore = item.courseworkScore + item.midtermExamScore;
      const totalMax = item.courseworkMax + item.midtermExamMax;
      const percent = totalMax > 0 ? Number(((totalScore / totalMax) * 100).toFixed(1)) : 0;

      return {
        subject: item.subject,
        teacher: item.teacher,
        coursework: item.courseworkMax > 0
          ? `${Number(item.courseworkScore.toFixed(2))}/${Number(item.courseworkMax.toFixed(2))}`
          : "—",
        midtermExam: item.midtermExamMax > 0
          ? `${Number(item.midtermExamScore.toFixed(2))}/${Number(item.midtermExamMax.toFixed(2))}`
          : "—",
        courseworkScore: Number(item.courseworkScore.toFixed(2)),
        courseworkMax: Number(item.courseworkMax.toFixed(2)),
        total: totalMax > 0
          ? `${Number(totalScore.toFixed(2))}/${Number(totalMax.toFixed(2))}`
          : "—",
        percent,
      };
    });

    // Calculate overall stats
    const totalTasks = assignments.length;
    const pendingTasks = assignments.filter((a) => a.status === "pending").length;
    const submittedTasks = assignments.filter((a) => a.status === "submitted").length;
    const totalEarned = assignments.reduce((sum, a) => sum + (a.rawScore ?? 0), 0);
    const totalMax = assignments.reduce((sum, a) => sum + a.maxScore, 0);
    const overallPercent = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

    let overallGpa = "—";
    if (scores.length > 0) {
      const validGrades = scores.map((s) => parseFloat(s.grade)).filter((g) => !isNaN(g));
      if (validGrades.length > 0) {
        overallGpa = (validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(2);
      }
    }

    // Dynamic announcements
    const announcements = [
      {
        id: 1,
        title: "ระบบตรวจสอบงานและผลคะแนนเปิดใช้งานแล้ว",
        teacher: "ระบบสารสนเทศ งานของครู",
        time: "วันนี้",
        detail: `ยินดีต้อนรับนักเรียนห้อง ${student.class.name} ทุกคนเข้าสู่ระบบเช็กงานค้างและสรุปคะแนนสอบ`,
      },
      ...(pendingTasks > 0
        ? [
            {
              id: 2,
              title: `คุณมีงานค้างที่ยังไม่ได้ส่งทั้งหมด ${pendingTasks} งาน`,
              teacher: teacherDefault,
              time: "อัปเดตล่าสุด",
              detail: "กรุณาตรวจสอบรายชื่องานในแท็บ 'งานค้าง / การบ้าน' และรีบดำเนินการส่งเพื่อไม่ให้เสียคะแนนเก็บนะครับ",
            },
          ]
        : [
            {
              id: 2,
              title: "🎉 ยอดเยี่ยมมาก! ส่งงานครบทุกชิ้นแล้ว",
              teacher: teacherDefault,
              time: "อัปเดตล่าสุด",
              detail: "คุณไม่มีงานค้างส่งในระบบในขณะนี้ หมั่นทบทวนบทเรียนเพื่อเตรียมพร้อมสำหรับการสอบนะครับ",
            },
          ]),
    ];

    const uniqueSubjects = Array.from(new Set(assignments.map((a) => a.subject))).filter(Boolean);

    return NextResponse.json({
      student: {
        id: student.studentNo,
        dbId: student.id,
        name: student.name,
        no: student.rollNo,
        class: student.class.name,
        school: student.class.owner?.defaultLearningArea || "งานของครู",
        rank: `ห้อง ${student.class.name}`,
        gpa: overallGpa !== "—" ? overallGpa : overallPercent > 0 ? (overallPercent / 25).toFixed(2) : "—",
      },
      summary: {
        totalTasks,
        pendingCount: pendingTasks,
        submittedCount: submittedTasks,
        totalScore: Number(totalEarned.toFixed(2)),
        maxScore: Number(totalMax.toFixed(2)),
      },
      subjects: ["ทั้งหมด", ...uniqueSubjects],
      assignments,
      scores,
      announcements,
    });
  } catch (error) {
    console.error("[StudentPortal] error:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลงานได้" }, { status: 500 });
  }
}
