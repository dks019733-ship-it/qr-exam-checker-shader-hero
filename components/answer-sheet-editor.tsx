"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, FileImage, ImagePlus, Loader2, Printer, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Classroom = { id: string; name: string; _count?: { students: number } };
type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };
type Template = { schoolName: string; logoDataUrl: string | null; examTitle: string; subject: string; questionCount: number; classLabel: string };

const initialTemplate: Template = { schoolName: "โรงเรียนตัวอย่างวิทยา", logoDataUrl: "/school-logo-reference.png", examTitle: "แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน", subject: "วิชาตัวอย่าง", questionCount: 40, classLabel: "ม.4/1" };

export function AnswerSheetEditor() {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentPreview, setStudentPreview] = useState({ rollNo: "", studentNo: "", name: "", qrToken: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const questions = useMemo(() => Array.from({ length: template.questionCount }, (_, i) => i + 1), [template.questionCount]);
  const filteredStudents = useMemo(() => students.filter((s) => `${s.rollNo} ${s.studentNo} ${s.name}`.toLowerCase().includes(studentSearch.toLowerCase())), [students, studentSearch]);

  useEffect(() => {
    Promise.all([
      fetch("/api/answer-sheet/template").then((r) => r.ok ? r.json() : null),
      fetch("/api/classes").then((r) => r.ok ? r.json() : []),
    ]).then(([saved, classes]) => {
      if (saved) setTemplate({ ...initialTemplate, ...saved, subject: saved.subject ?? "" });
      const uniqueClasses = Array.isArray(classes) ? [...new Map((classes as Classroom[]).map((classroom) => [classroom.id, classroom])).values()] : [];
      setClassrooms(uniqueClasses);
      if (uniqueClasses[0]) setClassId(uniqueClasses[0].id);
    }).catch(() => setStatus({ type: "error", text: "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่" })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    fetch(`/api/students?classId=${encodeURIComponent(classId)}`).then((r) => r.ok ? r.json() : []).then((rows: Student[]) => {
      setStudents(rows);
      if (rows[0]) selectStudent(rows[0]);
      else { setSelectedStudentId(""); setStudentPreview({ rollNo: "", studentNo: "", name: "", qrToken: "" }); }
    }).catch(() => setStatus({ type: "error", text: "โหลดรายชื่อนักเรียนไม่สำเร็จ" }));
  }, [classId]);

  function updateTemplate<K extends keyof Template>(key: K, value: Template[K]) { setTemplate((current) => ({ ...current, [key]: value })); setDirty(true); }
  function selectStudent(student: Student) { setSelectedStudentId(student.id); setStudentPreview({ rollNo: student.rollNo, studentNo: student.studentNo, name: student.name, qrToken: student.qrToken }); }
  function notify(type: "success" | "error" | "info", text: string) { setStatus({ type, text }); }

  async function saveTemplate() {
    setSaving(true); notify("info", "กำลังบันทึกการตั้งค่า...");
    try {
      const res = await fetch("/api/answer-sheet/template", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(template) });
      if (!res.ok) throw new Error();
      setDirty(false); notify("success", "บันทึกการตั้งค่ากระดาษคำตอบแล้ว");
    } catch { notify("error", "บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ"); } finally { setSaving(false); }
  }

  function handleLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return notify("error", "รองรับเฉพาะ PNG, JPG หรือ WebP");
    if (file.size > 500_000) return notify("error", "ไฟล์ตราโรงเรียนต้องไม่เกิน 500 KB");
    const reader = new FileReader(); reader.onload = () => updateTemplate("logoDataUrl", String(reader.result)); reader.readAsDataURL(file);
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />กำลังเตรียมพื้นที่ทำงาน...</div>;

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><FileImage className="h-4 w-4" />Answer sheet studio</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">สร้างกระดาษคำตอบ</h1><p className="mt-1 text-sm text-muted-foreground">ตั้งค่าข้อมูล แล้วดูตัวอย่างก่อนพิมพ์ได้ทันที</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />พิมพ์ / PDF</Button><Button onClick={saveTemplate} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{dirty ? "บันทึกการเปลี่ยนแปลง" : "บันทึกแล้ว"}</Button></div>
      </header>

      {status && <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${status.type === "error" ? "border-red-200 bg-red-50 text-red-800" : status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white"}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{status.text}</span><button className="ml-auto" onClick={() => setStatus(null)}><X className="h-4 w-4" /></button></div>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm print:hidden">
        <div className="text-sm text-muted-foreground">พิมพ์กระดาษคำตอบทีละคนด้านขวา หรือพิมพ์รวมทั้งห้องพร้อม QR ของทุกคนในคลิกเดียว</div>
        <a
          href={classId ? `/dashboard/answer-sheet/print?classId=${encodeURIComponent(classId)}` : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!classId}
          className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium ${classId ? "hover:bg-muted" : "pointer-events-none opacity-50"}`}
        >
          <Printer className="mr-2 h-4 w-4" />พิมพ์/ดาวน์โหลด PDF ทั้งห้อง ({students.length} คน)
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="space-y-4 print:hidden">
          <Panel title="ข้อมูลแบบทดสอบ" subtitle="ข้อมูลที่จะแสดงบนหัวกระดาษ">
            <Field label="ชื่อโรงเรียน"><input value={template.schoolName} onChange={(e) => updateTemplate("schoolName", e.target.value)} /></Field>
            <Field label="ชื่อแบบทดสอบ"><input value={template.examTitle} onChange={(e) => updateTemplate("examTitle", e.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="วิชาที่สอบ"><input value={template.subject} onChange={(e) => updateTemplate("subject", e.target.value)} /></Field><Field label="ชั้น / ห้อง"><input value={template.classLabel} onChange={(e) => updateTemplate("classLabel", e.target.value)} /></Field></div>
            <Field label="จำนวนข้อ"><select value={template.questionCount} onChange={(e) => updateTemplate("questionCount", Number(e.target.value))}>{[10,20,30,40,50,60,80,100].map((n) => <option key={n} value={n}>{n} ข้อ</option>)}</select></Field>
          </Panel>

          <Panel title="ตราโรงเรียน" subtitle="ไฟล์ PNG, JPG หรือ WebP ไม่เกิน 500 KB"><div className="flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border bg-slate-50 p-2">{template.logoDataUrl ? <img src={template.logoDataUrl} alt="ตราโรงเรียน" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}</div><div className="min-w-0"><button className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => logoInputRef.current?.click()}>เปลี่ยนตราโรงเรียน</button><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} /><button className="ml-2 text-xs text-muted-foreground underline" onClick={() => updateTemplate("logoDataUrl", null)}>ลบ</button></div></div></Panel>

          <Panel title="เลือกห้องสำหรับตัวอย่าง" subtitle="ตั้งค่าห้องและรายชื่อนักเรียนแยกที่หน้าจัดการห้องเรียน"><select className="w-full" value={classId} onChange={(e) => { setClassId(e.target.value); const c = classrooms.find((x) => x.id === e.target.value); if (c) updateTemplate("classLabel", c.name); }}><option value="">เลือกห้องเรียน</option>{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}{c._count ? ` (${c._count.students} คน)` : ""}</option>)}</select><Link href="/dashboard/classes" className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:underline">ไปจัดการห้องเรียนและนักเรียน →</Link></Panel>

          <Panel title="เลือกนักเรียนสำหรับตัวอย่าง" subtitle="เลือกรายชื่อเพื่อดูตัวอย่าง QR บนกระดาษคำตอบ"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className="pl-9" placeholder="ค้นหาชื่อ เลขที่ หรือรหัส..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /></div><select value={selectedStudentId} onChange={(e) => { const s = students.find((x) => x.id === e.target.value); if (s) selectStudent(s); }} className="mt-2"><option value="">เลือกนักเรียน ({filteredStudents.length})</option>{filteredStudents.map((s) => <option key={s.id} value={s.id}>{s.rollNo} · {s.studentNo} — {s.name}</option>)}</select><Link href="/dashboard/classes" className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:underline">เพิ่มหรือแก้ไขรายชื่อนักเรียน →</Link></Panel>
        </section>

        <section className="min-w-0 rounded-2xl border bg-white p-3 shadow-sm sm:p-5 print:border-0 print:p-0 print:shadow-none"><div className="mb-4 flex items-center justify-between print:hidden"><div><h2 className="font-semibold">ตัวอย่างก่อนพิมพ์</h2><p className="text-xs text-muted-foreground">A4 · ปรับตามข้อมูลด้านซ้าย</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-muted-foreground">{template.questionCount} ข้อ</span></div><div className="overflow-x-auto"><AnswerSheetPreview template={template} student={studentPreview} questions={questions} qrUrl={selectedStudentId ? `/api/students/${selectedStudentId}/qr` : undefined} /></div></section>
      </div>
    </div>
  </main>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}</div><div className="space-y-3">{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }

export function AnswerSheetPreview({ template, student, questions, qrUrl }: { template: Template; student: { rollNo: string; studentNo: string; name: string }; questions: number[]; qrUrl?: string }) { return <div className="mx-auto w-[794px] bg-white p-6 text-black" style={{ minHeight: "1123px" }}><header className="flex items-center gap-5 border-b pb-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center">{template.logoDataUrl ? <img src={template.logoDataUrl} alt="" className="max-h-20 max-w-20 object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full border text-[10px] text-gray-500">ตราโรงเรียน</div>}</div><div className="min-w-0 flex-1 text-center"><h3 className="text-xl font-bold">{template.schoolName || "ชื่อโรงเรียน"}</h3><p className="mt-1 text-sm">{template.examTitle || "ชื่อแบบทดสอบ"}</p><p className="mt-1 text-sm">วิชา {template.subject || "________________"} · ชั้น {template.classLabel || "________"}</p></div><div className="flex w-20 shrink-0 flex-col items-center text-center text-[9px] text-gray-500">{qrUrl ? <img src={qrUrl} alt="QR ประจำตัวนักเรียน" className="h-16 w-16 object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded border text-[10px]">QR</div>}<span className="mt-0.5">ประจำตัว</span></div></header><div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 border-y py-3 text-sm"><div>ชื่อ-สกุล: <span className="font-semibold">{student.name || "________________________"}</span></div><div>รหัสประจำตัวนักเรียน: <span className="font-semibold">{student.studentNo || "____________"}</span></div><div>เลขที่: <span className="font-semibold">{student.rollNo || "____________"}</span></div><div>ห้อง: {template.classLabel || "________"}</div><div>วันที่สอบ: ____ / ____ / ______</div><div>วิชา: {template.subject || "________________"}</div></div><div className="mt-4 rounded-lg border p-3 text-xs"><p className="font-semibold">คำชี้แจง</p><ol className="mt-1 list-decimal space-y-0.5 pl-5"><li>ทำเครื่องหมายวงกลมเลือกคำตอบที่ถูกต้องเพียงข้อเดียวในแต่ละข้อ</li><li>ใช้ดินสอ 2B ในการระบายคำตอบ</li><li>หากต้องการเปลี่ยนคำตอบ ให้ลบให้สะอาด แล้วระบายคำตอบใหม่</li><li>ห้ามขีด เขียน หรือทำเครื่องหมายอื่น ๆ ในกระดาษคำตอบ</li></ol></div><div className="mt-4 grid grid-cols-2 gap-4">{[questions.slice(0, Math.ceil(questions.length / 2)), questions.slice(Math.ceil(questions.length / 2))].map((column, colIndex) => <div key={colIndex} className="overflow-hidden rounded-lg border"><div className="grid grid-cols-[40px_repeat(4,1fr)] border-b bg-gray-50 text-center text-xs font-semibold"><div className="border-r p-2">ข้อ</div>{["A", "B", "C", "D"].map((c) => <div key={c} className="p-2">{c}</div>)}</div>{column.map((q) => <div key={q} className="grid grid-cols-[40px_repeat(4,1fr)] border-b last:border-b-0 text-center text-xs"><div className="border-r p-1.5 font-semibold">{q}</div>{["A", "B", "C", "D"].map((choice) => <div key={choice} className="flex items-center justify-center p-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-600">{choice}</span></div>)}</div>)}</div>)}</div><footer className="mt-5 grid grid-cols-[1fr_220px] gap-5 rounded-lg border p-4 text-xs"><div><p>หมายเหตุ :</p><div className="mt-7 border-b" /><div className="mt-6 border-b" /></div><div className="border-l pl-5"><p>ลงชื่อผู้ตรวจ</p><div className="mt-8 border-b" /><p className="mt-3">วันที่ ____ / ____ / ______</p></div></footer></div>; }
