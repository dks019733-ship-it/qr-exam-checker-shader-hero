"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { ExamWorkspaceNav } from "@/components/exam-workspace-nav";
import { StudentQrScanner } from "@/components/student-qr-scanner";
import { getExamChoiceKeys, getExamChoiceLabels } from "@/lib/exam-choices";

type Exam = {
  id: string;
  title: string;
  subject: string;
  classId: string | null;
  class?: { name: string } | null;
  choiceCount?: number;
  choiceLabelStyle?: string;
  questions: { number: number; answer: string }[];
};
type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };

function emptyAnswers(exam: Exam) {
  return Object.fromEntries(exam.questions.map((question) => [String(question.number), ""]));
}

export function AnswerEntry() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanResumeSignal, setScanResumeSignal] = useState(0);

  const eligibleExams = useMemo(
    () => exams.filter((item) => item.classId && item.questions?.length),
    [exams],
  );
  const choiceKeys = getExamChoiceKeys(exam?.choiceCount || 4);
  const choiceLabels = getExamChoiceLabels(exam?.choiceCount || 4, exam?.choiceLabelStyle || "LATIN");

  useEffect(() => {
    fetch("/api/exams")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((rows: Exam[]) => setExams(rows))
      .catch(() => setMessage("โหลดข้อสอบไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!examId) {
      setExam(null);
      setStudents([]);
      setStudentId("");
      setAnswers({});
      return;
    }

    let cancelled = false;
    fetch("/api/exams/" + encodeURIComponent(examId))
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Exam>;
      })
      .then(async (row) => {
        if (cancelled) return;
        setExam(row);
        setStudentId("");
        setAnswers(emptyAnswers(row));

        const response = await fetch("/api/students?classId=" + encodeURIComponent(row.classId || ""));
        if (!response.ok) throw new Error();
        const studentRows: Student[] = await response.json();
        if (!cancelled) setStudents(studentRows);
      })
      .catch(() => {
        if (!cancelled) setMessage("โหลดข้อมูลข้อสอบหรือนักเรียนไม่สำเร็จ");
      });

    return () => {
      cancelled = true;
    };
  }, [examId]);

  function selectStudent(nextStudentId: string) {
    if (nextStudentId !== studentId && exam) setAnswers(emptyAnswers(exam));
    setStudentId(nextStudentId);
    setMessage("");
  }

  function selectExam(nextExamId: string) {
    setExamId(nextExamId);
    setExam(null);
    setStudents([]);
    setStudentId("");
    setAnswers({});
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exam || !studentId) {
      setMessage("เลือกนักเรียนก่อน");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/exams/" + exam.id + "/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "บันทึกผลสอบไม่สำเร็จ");

      setMessage("บันทึกคำตอบแล้ว ได้ " + body.score + " / " + exam.questions.length + " คะแนน รอครูยืนยันที่หน้ารายงาน");
      setStudentId("");
      setAnswers(emptyAnswers(exam));
      setScanResumeSignal((current) => current + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกผลสอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600">
          <ArrowLeft className="h-4 w-4" />กลับหน้าแรก
        </Link>

        <header className="mt-5 rounded-2xl border border-[#dce8df] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#203e2d]">สแกนและตรวจคำตอบ</h1>
          <p className="mt-2 text-sm text-[#718276]">
            ใช้กล้องอ่าน QR เพื่อระบุตัวนักเรียน ตรวจคำตอบ และให้ครูยืนยันผลก่อนประกาศ
          </p>
        </header>

        <div className="mt-4"><ExamWorkspaceNav active="scan" /></div>
        {message && <p role="status" className="mt-4 rounded-xl border bg-white p-3 text-sm">{message}</p>}

        {loading ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-[#dce8df] bg-white p-5" aria-label="กำลังโหลดข้อมูลข้อสอบ">
            <div className="h-10 w-full animate-pulse rounded-lg bg-[#eef4ef]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-[#eef4ef]" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-[#f4f7f4]" />
          </div>
        ) : !eligibleExams.length ? (
          <div className="mt-5 rounded-2xl border bg-white p-6">
            ยังไม่มีข้อสอบที่ตั้งเฉลยแล้ว <Link className="underline" href="/dashboard/exams">ไปสร้างข้อสอบ</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                ข้อสอบ
                <select required value={examId} onChange={(event) => selectExam(event.target.value)} className="mt-1 w-full rounded-lg border p-2">
                  <option value="">เลือกข้อสอบ</option>
                  {eligibleExams.map((item) => (
                    <option key={item.id} value={item.id}>{item.title} · {item.class?.name || "ห้องเรียน"}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                นักเรียน
                <select required value={studentId} onChange={(event) => selectStudent(event.target.value)} disabled={!exam} className="mt-1 w-full rounded-lg border p-2">
                  <option value="">เลือกนักเรียน</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      เลขที่ {student.rollNo} · รหัส {student.studentNo} — {student.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {exam && students.length > 0 && (
              <StudentQrScanner
                key={exam.id}
                students={students}
                onStudentDetected={selectStudent}
                resumeSignal={scanResumeSignal}
              />
            )}

            {exam && students.length === 0 && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                ห้องเรียนนี้ยังไม่มีรายชื่อนักเรียนที่ใช้งานอยู่
              </p>
            )}

            {exam && (
              <>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[#203e2d]">ตรวจคำตอบจากกระดาษ</h2>
                  <span className="text-xs text-slate-500">{exam.questions.length} ข้อ · {choiceLabels.join(" / ")}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  หากนักเรียนไม่ตอบข้อนั้น ให้เลือก “เว้นว่าง” ระบบจะบันทึกเป็นคำตอบว่างโดยไม่เดาคำตอบแทน
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {exam.questions.map((question) => (
                    <fieldset key={question.number} className="rounded-lg border p-3">
                      <legend className="px-1 text-sm font-medium">ข้อ {question.number}</legend>
                      <div className="flex flex-wrap justify-between gap-2">
                        {choiceKeys.map((key, index) => (
                          <label key={key} className="flex cursor-pointer items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name={"q-" + question.number}
                              value={key}
                              checked={answers[String(question.number)] === key}
                              onChange={() => setAnswers((current) => ({ ...current, [String(question.number)]: key }))}
                            />
                            {choiceLabels[index]}
                          </label>
                        ))}
                        <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500">
                          <input
                            type="radio"
                            name={"q-" + question.number}
                            value=""
                            checked={answers[String(question.number)] === ""}
                            onChange={() => setAnswers((current) => ({ ...current, [String(question.number)]: "" }))}
                          />
                          เว้นว่าง
                        </label>
                      </div>
                    </fieldset>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={saving || !students.length || !studentId}
                  className="mt-5 inline-flex items-center rounded-lg bg-[#1d4b35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save className="mr-2 h-4 w-4" />{saving ? "กำลังบันทึก..." : "คิดคะแนนและบันทึกผล"}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
