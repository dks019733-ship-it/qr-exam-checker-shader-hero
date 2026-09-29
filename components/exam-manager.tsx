"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Save, Plus } from "lucide-react";

type Classroom = { id: string; name: string; _count?: { students: number } };
type Exam = { id: string; title: string; subject: string; classId: string | null; class?: { name: string } | null; status: string; questions?: { number: number; answer: string }[]; _count?: { attempts: number } };

export function ExamManager() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classId, setClassId] = useState("");
  const [count, setCount] = useState(10);
  const [answers, setAnswers] = useState<string[]>(Array(10).fill(""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([fetch("/api/classes"), fetch("/api/exams")]);
      if (!c.ok || !e.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const classRows = await c.json();
      const examRows = await e.json();
      setClasses(classRows); setExams(examRows);
      if (!classId && classRows[0]) setClassId(classRows[0].id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch("/api/exams/" + selectedId).then(async (r) => {
      if (!r.ok) throw new Error("เปิดข้อสอบไม่สำเร็จ");
      return r.json();
    }).then((exam: Exam) => {
      if (cancelled) return;
      setTitle(exam.title); setSubject(exam.subject || ""); setClassId(exam.classId || "");
      const saved = exam.questions || [];
      const nextCount = saved.length || 10;
      setCount(nextCount); setAnswers(Array.from({ length: nextCount }, (_, i) => saved[i]?.answer || ""));
      setMessage("");
    }).catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "เปิดข้อสอบไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selected = useMemo(() => exams.find((exam) => exam.id === selectedId), [exams, selectedId]);

  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!classId) return setMessage("สร้างห้องเรียนและนำเข้ารายชื่อนักเรียนก่อน");
    setSaving(true);
    try {
      const response = await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "ข้อสอบใหม่", subject: "", classId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "สร้างข้อสอบไม่สำเร็จ");
      setExams((current) => [body, ...current]); setSelectedId(body.id); setMessage("สร้างข้อสอบแล้ว กรอกเฉลยด้านขวาแล้วบันทึก");
    } catch (error) { setMessage(error instanceof Error ? error.message : "สร้างข้อสอบไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function saveExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!selectedId) return;
    if (answers.some((answer) => !answer)) return setMessage("เลือกเฉลยให้ครบทุกข้อก่อนบันทึก");
    setSaving(true);
    try {
      const response = await fetch("/api/exams/" + selectedId, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, subject, classId, questions: answers.map((answer, i) => ({ number: i + 1, answer })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      setExams((current) => current.map((exam) => exam.id === body.id ? { ...exam, ...body } : exam));
      setMessage("บันทึกข้อสอบและเฉลยแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  function changeCount(value: number) {
    const next = Math.min(100, Math.max(1, value || 1));
    setCount(next); setAnswers((current) => Array.from({ length: next }, (_, i) => current[i] || ""));
  }

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" />กลับแดชบอร์ด</Link>
    <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold">จัดการข้อสอบ</h1><p className="mt-2 text-sm text-slate-600">สร้างข้อสอบ เลือกห้อง และกำหนดเฉลยปรนัย 4 ตัวเลือก</p></header>
    {message && <p role="status" className="mt-4 rounded-xl border bg-white p-3 text-sm">{message}</p>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <form onSubmit={createExam} className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">สร้างข้อสอบใหม่</h2>
          {classes.length ? <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-3 w-full rounded-lg border p-2">{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <p className="mt-3 text-sm text-amber-700">ยังไม่มีห้องเรียน <Link className="underline" href="/dashboard/answer-sheet">ไปสร้างห้องและรายชื่อนักเรียน</Link></p>}
          <button disabled={saving || !classes.length} className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"><Plus className="mr-2 h-4 w-4" />สร้างข้อสอบ</button>
        </form>
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">ข้อสอบของฉัน</h2>{loading ? <Loader2 className="mt-4 h-5 w-5 animate-spin" /> : exams.length ? <ul className="mt-3 space-y-2">{exams.map((exam) => <li key={exam.id}><button onClick={() => setSelectedId(exam.id)} className={"w-full rounded-lg border p-3 text-left text-sm " + (selectedId === exam.id ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50")}><span className="block font-medium">{exam.title}</span><span className="text-xs text-slate-500">{exam.class?.name || "ยังไม่เลือกห้อง"} · {exam._count?.attempts || 0} คน</span></button></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">ยังไม่มีข้อสอบ</p>}</section>
      </aside>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        {!selected ? <div className="py-10 text-center text-sm text-slate-500"><BookOpen className="mx-auto mb-3 h-8 w-8" />สร้างหรือเลือกข้อสอบเพื่อกำหนดเฉลย</div> : <form onSubmit={saveExam}>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">ชื่อข้อสอบ<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">วิชา<input maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></div>
          <label className="mt-3 block text-sm">ห้องเรียน<select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 w-full rounded-lg border p-2">{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="mt-3 block text-sm">จำนวนข้อ<select value={count} disabled={Boolean(selected._count?.attempts)} onChange={(e) => changeCount(Number(e.target.value))} className="mt-1 rounded-lg border p-2">{[5,10,15,20,30,40,50,60,80,100].map((n) => <option key={n} value={n}>{n} ข้อ</option>)}</select></label>
          {selected._count?.attempts ? <p className="mt-3 text-sm text-amber-700">ข้อสอบมีผลสอบแล้ว จึงล็อกเฉลยไว้</p> : <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{answers.map((answer, i) => <label key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><span className="w-10">ข้อ {i + 1}</span><select required aria-label={"เฉลยข้อ " + (i + 1)} value={answer} onChange={(e) => setAnswers((current) => current.map((item, index) => index === i ? e.target.value : item))} className="min-w-0 flex-1 rounded border p-1"><option value="">เลือก</option>{["A","B","C","D"].map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>)}</div>}
          {!selected._count?.attempts && <button disabled={saving} className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white disabled:opacity-50"><Save className="mr-2 h-4 w-4" />{saving ? "กำลังบันทึก..." : "บันทึกข้อสอบและเฉลย"}</button>}
        </form>}
      </section>
    </div>
  </div></main>;
}
