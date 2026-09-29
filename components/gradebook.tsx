"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

type Period = "MIDTERM" | "AFTER_MIDTERM";
type Classroom = { id: string; name: string };
type Student = { id: string; rollNo: string; studentNo: string; name: string };
type Score = { studentId: string; score: number | null };
type Column = { id: string; title: string; period: Period; maxScore: number; examId: string | null; googleFormId: string | null; scores: Score[]; exam: { title: string } | null; googleForm: { material: { title: string } } | null };
type ExamOption = { id: string; title: string; classId: string | null; _count: { questions: number }; gradeColumn: { id: string } | null };
type FormOption = { id: string; material: { title: string }; gradeColumn: { id: string } | null };
type Payload = { classes: Classroom[]; classroom?: Classroom; students?: Student[]; columns?: Column[]; exams: ExamOption[]; googleForms: FormOption[] };

const periods: { id: Period; label: string }[] = [
  { id: "MIDTERM", label: "กลางภาค" },
  { id: "AFTER_MIDTERM", label: "หลังกลางภาค" },
];
const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
const keyOf = (columnId: string, studentId: string) => `${columnId}:${studentId}`;

export function Gradebook() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState<Period>("AFTER_MIDTERM");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [sourceType, setSourceType] = useState("manual");
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (selectedId = classId) => {
    const response = await fetch(selectedId ? `/api/gradebook?classId=${encodeURIComponent(selectedId)}` : "/api/gradebook");
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "โหลดสมุดคะแนนไม่สำเร็จ");
    const data = body as Payload;
    setPayload(data);
    if (!selectedId && data.classes[0]) setClassId(data.classes[0].id);
    setDraft({});
  }, [classId]);

  useEffect(() => { void load("").catch((error) => setMessage(error.message)); }, []);
  useEffect(() => { if (classId) void load(classId).catch((error) => setMessage(error.message)); }, [classId]);

  const students = payload?.students || [];
  const columns = payload?.columns || [];
  const periodColumns = useMemo(() => columns.filter((column) => column.period === period), [columns, period]);
  const scoreAt = (column: Column, studentId: string) => column.scores.find((score) => score.studentId === studentId)?.score ?? null;
  const scoreValue = (column: Column, studentId: string) => draft[keyOf(column.id, studentId)] ?? (scoreAt(column, studentId)?.toString() ?? "");
  const sum = (student: Student, subset: Column[]) => subset.reduce((total, column) => total + (scoreAt(column, student.id) ?? 0), 0);
  const maxSum = (subset: Column[]) => subset.reduce((total, column) => total + column.maxScore, 0);

  async function addColumn(event: React.FormEvent) {
    event.preventDefault();
    if (!classId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/gradebook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, title, period, maxScore: Number(maxScore), sourceType, sourceId }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "เพิ่มช่องคะแนนไม่สำเร็จ");
      setShowAdd(false); setTitle(""); setSourceId("");
      let notice = "เพิ่มช่องคะแนนแล้ว";
      if (sourceType === "google_form") {
        const sync = await fetch(`/api/gradebook/columns/${body.id}/sync`, { method: "POST" });
        const result = await sync.json().catch(() => null);
        notice = sync.ok ? `เพิ่มแล้วและนำเข้าคะแนน ${result.imported} คน${result.skipped ? ` (จับคู่ไม่ได้ ${result.skipped} รายการ)` : ""}` : `เพิ่มช่องแล้ว แต่ซิงก์ไม่สำเร็จ: ${result?.error || "กรุณากดซิงก์อีกครั้ง"}`;
      }
      await load(classId); setMessage(notice);
    } catch (error) { setMessage(error instanceof Error ? error.message : "เพิ่มช่องคะแนนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function saveScore(column: Column, student: Student) {
    const key = keyOf(column.id, student.id);
    const raw = scoreValue(column, student.id).trim();
    const score = raw === "" ? null : Number(raw);
    if (score !== null && !Number.isFinite(score)) {
      setMessage(`กรุณากรอกคะแนนของ ${student.name} เป็นตัวเลข`); return;
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/gradebook/scores", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ columnId: column.id, studentId: student.id, score }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "บันทึกคะแนนไม่สำเร็จ");
      await load(classId); setMessage("บันทึกคะแนนแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกคะแนนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function syncForm(column: Column) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/gradebook/columns/${column.id}/sync`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "ซิงก์คะแนนไม่สำเร็จ");
      await load(classId); setMessage(`นำเข้าคะแนน ${body.imported} คน${body.skipped ? ` · จับคู่ไม่ได้ ${body.skipped} รายการ` : ""}${body.ungraded ? ` · ยังไม่ตรวจ ${body.ungraded} รายการ` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "ซิงก์คะแนนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function deleteColumn(column: Column) {
    if (!window.confirm(`ลบช่องคะแนน “${column.title}” และคะแนนในช่องนี้หรือไม่`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/gradebook/columns/${column.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "ลบช่องคะแนนไม่สำเร็จ");
      await load(classId); setMessage("ลบช่องคะแนนแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "ลบช่องคะแนนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    const safe = (value: unknown) => { const text = String(value ?? ""); return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`; };
    const rows: unknown[][] = [["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล", ...columns.map((column) => `${column.title} (${periods.find((item) => item.id === column.period)?.label}, เต็ม ${column.maxScore})`), ...periods.map((item) => `${item.label} (รวมเต็ม ${maxSum(columns.filter((column) => column.period === item.id))})`), "รวมคะแนน", "คะแนนเต็ม"]];
    for (const student of students) rows.push([student.rollNo, student.studentNo, student.name, ...columns.map((column) => scoreAt(column, student.id) ?? ""), ...periods.map((item) => sum(student, columns.filter((column) => column.period === item.id))), sum(student, columns), maxSum(columns)]);
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `คะแนน-${payload?.classroom?.name || "ห้องเรียน"}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-7xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" />กลับแดชบอร์ด</Link>
    <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">สมุดคะแนนออนไลน์</h1><p className="mt-2 text-sm text-slate-600">บันทึกคะแนนงาน/บทในช่วงกลางภาคหรือหลังกลางภาค พร้อมรวมคะแนนตามช่องใน SGS</p></div><div className="flex flex-wrap gap-2"><button onClick={exportCsv} disabled={!students.length} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Download className="mr-2 h-4 w-4" />ส่งออกคะแนน</button><Link href="/dashboard/classes" className="rounded-lg border px-3 py-2 text-sm">จัดการห้องเรียน</Link></div></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><label className="text-sm font-medium">ห้องเรียน</label><select className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">เลือกห้องเรียน</option>{payload?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="text-sm text-slate-500">{students.length} คน</span></div>
    </header>
    {message && <p role="status" className="mt-4 rounded-xl border bg-white p-3 text-sm">{message}</p>}
    {!payload ? <div className="mt-6 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลดสมุดคะแนน</div> : !payload.classes.length ? <section className="mt-5 rounded-2xl border bg-white p-8 text-center"><p className="font-medium">ยังไม่มีห้องเรียน</p><Link href="/dashboard/classes" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">ไปจัดการห้องเรียน</Link></section> : !classId ? null : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{periods.map((item) => { const items = columns.filter((column) => column.period === item.id); return <button key={item.id} onClick={() => setPeriod(item.id)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm ${period === item.id ? "border-slate-900 ring-1 ring-slate-900" : ""}`}><span className="text-sm font-medium">{item.label}</span><div className="mt-2 text-xl font-semibold">รวมเต็ม {maxSum(items)} คะแนน</div><p className="mt-1 text-xs text-slate-500">{items.length} งาน/บท · รวมตรงตามคะแนนเต็ม เช่น 3 งาน งานละ 10 รวม 30</p></button>; })}</div>
      <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5"><div><h2 className="font-semibold">{periods.find((item) => item.id === period)?.label}</h2><p className="mt-1 text-xs text-slate-500">เพิ่มงาน/บทได้หลายรายการ แต่ละช่องกำหนดคะแนนเต็มได้</p></div><button onClick={() => { setSourceType("manual"); setSourceId(""); setTitle(""); setMaxScore("10"); setShowAdd((value) => !value); }} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"><Plus className="mr-1.5 h-4 w-4" />เพิ่มงาน / บท</button></div>
        {showAdd && <form onSubmit={addColumn} className="grid gap-3 border-b bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="grid gap-1 text-xs font-medium">หัวข้องาน / บท<input required maxLength={120} className={inputClass} placeholder="เช่น บทที่ 1 หรือ ใบงานที่ 1" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium">ช่วงคะแนน<select className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="grid gap-1 text-xs font-medium">คะแนนเต็ม<input required type="number" min="0.01" step="0.01" className={inputClass} value={maxScore} onChange={(event) => setMaxScore(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium">นำคะแนนจาก<select className={inputClass} value={sourceType} onChange={(event) => { setSourceType(event.target.value); setSourceId(""); }}><option value="manual">กรอกเอง</option><option value="exam">ข้อสอบที่ตรวจแล้ว</option><option value="google_form">Google Forms</option></select></label>{sourceType !== "manual" && <label className="grid gap-1 text-xs font-medium">เลือกรายการ<select required className={inputClass} value={sourceId} onChange={(event) => { setSourceId(event.target.value); if (!title) { const selected = sourceType === "exam" ? payload.exams.find((item) => item.id === event.target.value)?.title : payload.googleForms.find((item) => item.id === event.target.value)?.material.title; if (selected) setTitle(selected); } }}><option value="">เลือกรายการ</option>{sourceType === "exam" ? payload.exams.filter((item) => item.classId === classId && !item.gradeColumn).map((item) => <option key={item.id} value={item.id}>{item.title} ({item._count.questions} ข้อ)</option>) : payload.googleForms.filter((item) => !item.gradeColumn).map((item) => <option key={item.id} value={item.id}>{item.material.title}</option>)}</select></label>}<div className="flex items-end gap-2"><button disabled={busy} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"><Save className="mr-1.5 h-4 w-4" />บันทึกช่อง</button><button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border bg-white px-3 py-2 text-sm">ยกเลิก</button></div></form>}
        {!students.length ? <div className="p-8 text-center text-sm text-slate-500">ห้องนี้ยังไม่มีรายชื่อนักเรียน <Link className="underline" href="/dashboard/classes">เพิ่มรายชื่อนักเรียน</Link></div> : <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-600"><th className="sticky left-0 z-10 min-w-14 bg-slate-50 p-3">เลขที่</th><th className="sticky left-14 z-10 min-w-48 bg-slate-50 p-3">นักเรียน</th>{periodColumns.map((column) => <th key={column.id} className="min-w-32 border-l p-3"><div className="flex items-start justify-between gap-2"><span>{column.title}</span><button title="ลบช่องคะแนน" onClick={() => void deleteColumn(column)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-1 font-normal">เต็ม {column.maxScore}</div>{column.googleFormId && <button onClick={() => void syncForm(column)} disabled={busy} className="mt-2 inline-flex items-center text-[11px] font-medium text-blue-700"><RefreshCw className="mr-1 h-3 w-3" />ซิงก์ฟอร์ม</button>}{column.examId && <div className="mt-2 text-[11px] font-normal text-emerald-700">เชื่อมข้อสอบแล้ว</div>}</th>)}<th className="min-w-28 border-l bg-amber-50 p-3">รวมช่วงนี้<br /><span className="font-normal">/{maxSum(periodColumns)}</span></th><th className="sticky right-0 z-10 min-w-28 border-l bg-slate-100 p-3">รวมทั้งหมด<br /><span className="font-normal">/{maxSum(columns)}</span></th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-t hover:bg-slate-50/70"><td className="sticky left-0 bg-white p-3">{student.rollNo || student.studentNo}</td><td className="sticky left-14 bg-white p-3"><div className="font-medium">{student.name}</div><div className="text-xs text-slate-500">{student.studentNo}</div></td>{periodColumns.map((column) => <td key={column.id} className="border-l p-2"><input aria-label={`${student.name} ${column.title}`} type="number" min="0" step="0.01" className={`${inputClass} w-24 text-center`} value={scoreValue(column, student.id)} onChange={(event) => setDraft((current) => ({ ...current, [keyOf(column.id, student.id)]: event.target.value }))} onBlur={() => void saveScore(column, student)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></td>)}<td className="border-l bg-amber-50/50 p-3 font-semibold">{sum(student, periodColumns).toFixed(2).replace(/\.00$/, "")} / {maxSum(periodColumns)}</td><td className="sticky right-0 border-l bg-slate-50 p-3 font-semibold">{sum(student, columns).toFixed(2).replace(/\.00$/, "")} / {maxSum(columns)}</td></tr>)}</tbody></table></div>}
        <div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500">คลิกช่องคะแนนแล้วพิมพ์ได้เลย ระบบบันทึกเมื่อออกจากช่อง · ลบคะแนนโดยลบตัวเลขแล้วออกจากช่อง · คะแนนรวมอัปเดตทันที</div>
      </section>
      <p className="mt-3 text-xs text-slate-500">เลือกช่วงให้ตรงกับ SGS แล้วเพิ่มช่องงาน/บทพร้อมคะแนนเต็มแต่ละช่อง ยอดรวมแสดงตรง ๆ เช่น 3 งาน งานละ 10 คะแนน รวม 30 · คะแนนข้อสอบเข้าหลังครูยืนยัน · Google Forms จับคู่ด้วยเลขที่ ห้อง และชื่อ</p>
    </>}
  </div></main>;
}
