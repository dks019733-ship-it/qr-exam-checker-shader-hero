"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";

type Exam = { id: string; title: string; subject: string; classId: string | null; class?: { name: string } | null; questions: { number: number; answer: string }[] };
type Student = { id: string; rollNo: string; studentNo: string; name: string };

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
  const eligibleExams = useMemo(() => exams.filter((item) => item.classId && item.questions?.length), [exams]);

  useEffect(() => { fetch("/api/exams").then(async (r) => { if (!r.ok) throw new Error(); return r.json(); }).then((rows: Exam[]) => setExams(rows)).catch(() => setMessage("โหลดข้อสอบไม่สำเร็จ")).finally(() => setLoading(false)); }, []);

  useEffect(() => {
    if (!examId) { setExam(null); setStudents([]); return; }
    let cancelled = false;
    fetch("/api/exams/" + examId).then(async (r) => { if (!r.ok) throw new Error(); return r.json(); }).then(async (row: Exam) => {
      if (cancelled) return;
      setExam(row); setAnswers(Object.fromEntries(row.questions.map((q) => [String(q.number), ""])));
      const response = await fetch("/api/students?classId=" + encodeURIComponent(row.classId || ""));
      if (!response.ok) throw new Error();
      const studentRows = await response.json();
      if (!cancelled) { setStudents(studentRows); setStudentId(""); }
    }).catch(() => { if (!cancelled) setMessage("โหลดข้อมูลข้อสอบหรือนักเรียนไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [examId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exam || !studentId) return setMessage("เลือกนักเรียนก่อน");
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/exams/" + exam.id + "/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId, answers }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "บันทึกผลสอบไม่สำเร็จ");
      setMessage("บันทึกคำตอบแล้ว ได้ " + body.score + " / " + exam.questions.length + " คะแนน รอครูยืนยันที่หน้ารายงาน");
      setStudentId(""); setAnswers(Object.fromEntries(exam.questions.map((q) => [String(q.number), ""])));
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกผลสอบไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" />กลับแดชบอร์ด</Link>
    <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold">ตรวจและบันทึกคำตอบ</h1><p className="mt-2 text-sm text-slate-600">ตอนนี้กรอกคำตอบจากกระดาษที่ตรวจแล้ว ระบบคิดคะแนนและส่งให้ครูยืนยันก่อนประกาศ</p></header>
    {message && <p role="status" className="mt-4 rounded-xl border bg-white p-3 text-sm">{message}</p>}
    {!eligibleExams.length ? <div className="mt-5 rounded-2xl border bg-white p-6">ยังไม่มีข้อสอบที่ตั้งเฉลยแล้ว <Link className="underline" href="/dashboard/exams">ไปสร้างข้อสอบ</Link></div> : <form onSubmit={submit} className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">ข้อสอบ<select required value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">เลือกข้อสอบ</option>{eligibleExams.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.class?.name || "ห้องเรียน"}</option>)}</select></label><label className="text-sm">นักเรียน<select required value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!exam} className="mt-1 w-full rounded-lg border p-2"><option value="">เลือกนักเรียน</option>{students.map((student) => <option key={student.id} value={student.id}>เลขที่ {student.rollNo} · รหัส {student.studentNo} — {student.name}</option>)}</select></label></div>
      {exam && <><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{exam.questions.map((question) => <fieldset key={question.number} className="rounded-lg border p-3"><legend className="px-1 text-sm font-medium">ข้อ {question.number}</legend><div className="flex justify-between gap-1">{["A","B","C","D"].map((choice) => <label key={choice} className="flex cursor-pointer items-center gap-1 text-sm"><input required type="radio" name={"q-" + question.number} checked={answers[String(question.number)] === choice} onChange={() => setAnswers((current) => ({ ...current, [String(question.number)]: choice }))} />{choice}</label>)}</div></fieldset>)}</div><button disabled={saving || !students.length} className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white disabled:opacity-50"><Save className="mr-2 h-4 w-4" />{saving ? "กำลังบันทึก..." : "คิดคะแนนและบันทึก"}</button></>}
    </form>}
  </div></main>;
}
