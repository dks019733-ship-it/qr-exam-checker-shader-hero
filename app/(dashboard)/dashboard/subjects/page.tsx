"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Plus, RefreshCw } from "lucide-react";

type Classroom = { id: string; name: string };
type Assignment = {
  id: string;
  subject: { id: string; code: string; name: string };
  classroom: { id: string; name: string };
  _count: { enrollments: number; exams: number; gradeColumns: number };
};

export default function SubjectsPage() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [classResponse, assignmentResponse] = await Promise.all([
      fetch("/api/classes"),
      fetch("/api/teaching-assignments"),
    ]);
    const [classData, assignmentData] = await Promise.all([
      classResponse.json().catch(() => []),
      assignmentResponse.json().catch(() => []),
    ]);
    if (!classResponse.ok || !assignmentResponse.ok) throw new Error("โหลดข้อมูลรายวิชาไม่สำเร็จ");
    setClasses(classData);
    setAssignments(assignmentData);
    setClassId((current) => current || classData[0]?.id || "");
  }, []);

  useEffect(() => { void load().catch((error) => setNotice(error.message)); }, [load]);

  async function createAssignment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/teaching-assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name, classId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "เพิ่มรายวิชาไม่สำเร็จ");
      setCode("");
      setName("");
      await load();
      setNotice("เพิ่มรายวิชาและห้องเรียนแล้ว");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "เพิ่มรายวิชาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าแรก
        </Link>

        <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3"><BookOpen className="h-5 w-5" /></div>
            <div>
              <h1 className="text-2xl font-semibold">รายวิชาที่สอน</h1>
              <p className="mt-1 text-sm text-slate-600">ครูหนึ่งคนเพิ่มได้หลายรหัสวิชา และเลือกห้องเรียนที่รับผิดชอบแยกกันได้</p>
            </div>
          </div>
        </header>

        {notice && <p role="status" className="mt-4 rounded-xl border bg-white px-4 py-3 text-sm">{notice}</p>}

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">เพิ่มรายวิชาที่สอน</h2>
          <form onSubmit={createAssignment} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">รหัสวิชา
              <input required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} placeholder="เช่น ส21101" className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="text-sm">ชื่อวิชา
              <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น สังคมศึกษาพื้นฐาน" className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="text-sm sm:col-span-2">ห้องเรียนที่สอน
              <select required value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
                <option value="">เลือกห้องเรียน</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {!classes.length && <span className="mt-1 block text-xs text-amber-700">ยังไม่มีห้องเรียน กรุณาสร้างห้องเรียนก่อน</span>}
            </label>
            <div className="sm:col-span-2">
              <button disabled={busy || !classes.length} className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white disabled:opacity-50">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                เพิ่มวิชาในห้องนี้
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">วิชาและห้องเรียนที่รับผิดชอบ</h2>
            <button onClick={() => void load().catch((error) => setNotice(error.message))} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />รีเฟรช</button>
          </div>
          {!assignments.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีรายวิชา เพิ่มรายวิชาด้านบนเพื่อเริ่มต้น</p> : (
            <div className="mt-4 divide-y">
              {assignments.map((item) => (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{item.subject.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.subject.code} · {item.classroom.name}</p>
                  </div>
                  <p className="text-xs text-slate-500">{item._count.enrollments} นักเรียน · {item._count.exams} ข้อสอบ · {item._count.gradeColumns} ช่องคะแนน</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
