"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, FileImage, ImagePlus, Loader2, Printer, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnswerSheetStudentTools } from "@/components/answer-sheet-student-tools";
import { ExamWorkspaceNav } from "@/components/exam-workspace-nav";
import { getExamChoiceLabels } from "@/lib/exam-choices";
import { OMR_GRID, OMR_PAGE_HEIGHT, OMR_PAGE_WIDTH } from "@/lib/omr-layout";

type Classroom = { id: string; name: string; _count?: { students: number } };
type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };
type Template = { schoolName: string; logoDataUrl: string | null; examTitle: string; subject: string; questionCount: number; choiceCount: number; choiceLabelStyle: string; classLabel: string };

const initialTemplate: Template = { schoolName: "โรงเรียนตัวอย่างวิทยา", logoDataUrl: "/school-logo-reference.png", examTitle: "แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน", subject: "วิชาตัวอย่าง", questionCount: 40, choiceCount: 4, choiceLabelStyle: "LATIN", classLabel: "ม.4/1" };

export function AnswerSheetEditor() {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentPreview, setStudentPreview] = useState({ rollNo: "", studentNo: "", name: "", qrToken: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheetMode, setSheetMode] = useState<"qr" | "plain">("qr");
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
    }).catch(() => setStatus({ type: "error", text: "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่" }));
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

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#dce8df] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><FileImage className="h-4 w-4" />Answer sheet studio</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">สร้างกระดาษคำตอบ</h1><p className="mt-1 text-sm text-muted-foreground">ตั้งค่าข้อมูล แล้วดูตัวอย่างก่อนพิมพ์ได้ทันที</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />พิมพ์ / PDF</Button><Button onClick={saveTemplate} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{dirty ? "บันทึกการเปลี่ยนแปลง" : "บันทึกแล้ว"}</Button></div>
      </header>
      <div className="mb-5 print:hidden"><ExamWorkspaceNav active="sheets" /></div>

      {status && <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${status.type === "error" ? "border-red-200 bg-red-50 text-red-800" : status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white"}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{status.text}</span><button className="ml-auto" onClick={() => setStatus(null)}><X className="h-4 w-4" /></button></div>}

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#dce8df] bg-white p-4 shadow-sm print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold text-[#244632]">รูปแบบกระดาษคำตอบ</p><p className="mt-1 text-xs text-[#758579]">เลือกแบบมี QR สำหรับระบุตัวนักเรียน หรือแบบธรรมดาที่ให้นักเรียนเขียนชื่อเอง</p><div className="mt-3 inline-flex rounded-xl bg-[#f0f5f0] p-1"><button type="button" aria-pressed={sheetMode === "qr"} onClick={() => setSheetMode("qr")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${sheetMode === "qr" ? "bg-[#1d4b35] text-white shadow-sm" : "text-[#58705e] hover:bg-white"}`}>แบบ QR</button><button type="button" aria-pressed={sheetMode === "plain"} onClick={() => setSheetMode("plain")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${sheetMode === "plain" ? "bg-[#1d4b35] text-white shadow-sm" : "text-[#58705e] hover:bg-white"}`}>แบบธรรมดา · ไม่มี QR</button></div></div>
        <a
          href={classId ? `/dashboard/answer-sheet/print?classId=${encodeURIComponent(classId)}&mode=${sheetMode}` : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!classId}
          className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium ${classId ? "hover:bg-muted" : "pointer-events-none opacity-50"}`}
        >
          <Printer className="mr-2 h-4 w-4" />พิมพ์แบบ{sheetMode === "qr" ? " QR" : "ธรรมดา"} ทั้งห้อง ({students.length} คน)
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="space-y-4 print:hidden">
          <Panel title="ข้อมูลแบบทดสอบ" subtitle="ข้อมูลที่จะแสดงบนหัวกระดาษ">
            <Field label="ชื่อโรงเรียน"><input value={template.schoolName} onChange={(e) => updateTemplate("schoolName", e.target.value)} /></Field>
            <Field label="ชื่อแบบทดสอบ"><input value={template.examTitle} onChange={(e) => updateTemplate("examTitle", e.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="วิชาที่สอบ"><input value={template.subject} onChange={(e) => updateTemplate("subject", e.target.value)} /></Field><Field label="ชั้น / ห้อง"><input value={template.classLabel} onChange={(e) => updateTemplate("classLabel", e.target.value)} /></Field></div>
            <Field label="จำนวนข้อ"><select value={template.questionCount} onChange={(e) => updateTemplate("questionCount", Number(e.target.value))}>{[10,20,30,40,50,60,80,100].map((n) => <option key={n} value={n}>{n} ข้อ</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="จำนวนตัวเลือก"><select value={template.choiceCount} onChange={(e) => updateTemplate("choiceCount", Number(e.target.value))}><option value={4}>4 ตัวเลือก</option><option value={5}>5 ตัวเลือก</option></select></Field>
              <Field label="รูปแบบตัวเลือก"><select value={template.choiceLabelStyle} onChange={(e) => updateTemplate("choiceLabelStyle", e.target.value)}><option value="LATIN">A, B, C, D, E</option><option value="THAI">ก, ข, ค, ง, จ</option><option value="NUMERIC">1, 2, 3, 4, 5</option></select></Field>
            </div>
            <p className="text-[11px] leading-5 text-amber-700">ตั้งค่าให้ตรงกับจำนวนและรูปแบบตัวเลือกของข้อสอบก่อนพิมพ์กระดาษคำตอบ</p>
          </Panel>

          <Panel title="ตราโรงเรียน" subtitle="ไฟล์ PNG, JPG หรือ WebP ไม่เกิน 500 KB"><div className="flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border bg-slate-50 p-2">{template.logoDataUrl ? <img src={template.logoDataUrl} alt="ตราโรงเรียน" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}</div><div className="min-w-0"><button className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => logoInputRef.current?.click()}>เปลี่ยนตราโรงเรียน</button><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} /><button className="ml-2 text-xs text-muted-foreground underline" onClick={() => updateTemplate("logoDataUrl", null)}>ลบ</button></div></div></Panel>

          <Panel title="เลือกห้องสำหรับตัวอย่าง" subtitle="ตั้งค่าห้องและรายชื่อนักเรียนแยกที่หน้าจัดการห้องเรียน"><select className="w-full" value={classId} onChange={(e) => { setClassId(e.target.value); const c = classrooms.find((x) => x.id === e.target.value); if (c) updateTemplate("classLabel", c.name); }}><option value="">เลือกห้องเรียน</option>{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}{c._count ? ` (${c._count.students} คน)` : ""}</option>)}</select><Link href="/dashboard/classes" className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:underline">ไปจัดการห้องเรียนและนักเรียน →</Link></Panel>

          <Panel title="จัดการรายชื่อนักเรียน" subtitle="นำเข้ารายชื่อหลายคนพร้อมกัน หรือแก้ไขข้อมูลนักเรียนที่เลือก"><AnswerSheetStudentTools classId={classId} students={students} selectedStudentId={selectedStudentId} onSelect={selectStudent} onStudentsChange={setStudents} /></Panel>
          <Panel title="เลือกนักเรียนสำหรับตัวอย่าง" subtitle="เลือกรายชื่อเพื่อดูตัวอย่างกระดาษคำตอบ"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className="pl-9" placeholder="ค้นหาชื่อ เลขที่ หรือรหัส..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /></div><select value={selectedStudentId} onChange={(e) => { const s = students.find((x) => x.id === e.target.value); if (s) selectStudent(s); }} className="mt-2"><option value="">เลือกนักเรียน ({filteredStudents.length})</option>{filteredStudents.map((s) => <option key={s.id} value={s.id}>{s.rollNo} · {s.studentNo} — {s.name}</option>)}</select><Link href="/dashboard/classes" className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:underline">เพิ่มหรือแก้ไขรายชื่อนักเรียน →</Link></Panel>
        </section>

        <section className="min-w-0 rounded-2xl border bg-white p-3 shadow-sm sm:p-5 print:border-0 print:p-0 print:shadow-none"><div className="mb-4 flex items-center justify-between print:hidden"><div><h2 className="font-semibold">ตัวอย่างก่อนพิมพ์</h2><p className="text-xs text-muted-foreground">A4 · ปรับตามข้อมูลด้านซ้าย</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-muted-foreground">{template.questionCount} ข้อ</span></div><div className="overflow-x-auto"><AnswerSheetPreview template={template} student={studentPreview} questions={questions} qrUrl={sheetMode === "qr" && selectedStudentId ? `/api/students/${selectedStudentId}/qr` : undefined} showQr={sheetMode === "qr"} /></div></section>
      </div>
    </div>
  </main>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}</div><div className="space-y-3">{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }

export function AnswerSheetPreview({ template, student, questions, qrUrl, showQr = true }: { template: Template; student: { rollNo: string; studentNo: string; name: string }; questions: number[]; qrUrl?: string; showQr?: boolean }) {
  const choiceLabels = getExamChoiceLabels(template.choiceCount || 4, template.choiceLabelStyle || "LATIN");
  const choiceGridStyle = { gridTemplateColumns: `${OMR_GRID.questionColumnWidth}px repeat(${choiceLabels.length}, minmax(0, 1fr))` };
  const splitIndex = Math.ceil(questions.length / 2);
  const columns = [questions.slice(0, splitIndex), questions.slice(splitIndex)];

  return (
    <div data-omr-sheet-version="1" className="omr-answer-sheet relative mx-auto overflow-hidden bg-white text-black" style={{ width: OMR_PAGE_WIDTH, height: OMR_PAGE_HEIGHT }}>
      <span aria-hidden="true" data-omr-marker="top-left" className="absolute left-8 top-8 h-[14px] w-[14px] border-[7px] border-black" />
      <span aria-hidden="true" data-omr-marker="top-right" className="absolute right-8 top-8 h-[14px] w-[14px] border-[7px] border-black" />
      <span aria-hidden="true" data-omr-marker="bottom-left" className="absolute bottom-8 left-8 h-[14px] w-[14px] border-[7px] border-black" />
      <span aria-hidden="true" data-omr-marker="bottom-right" className="absolute bottom-8 right-8 h-[14px] w-[14px] border-[7px] border-black" />

      <header className="absolute left-[52px] right-[52px] top-[52px] flex h-[80px] items-center gap-4 border-b border-black pb-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center">
          {template.logoDataUrl ? <img src={template.logoDataUrl} alt="" className="max-h-16 max-w-16 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full border text-[9px] text-gray-500">ตราโรงเรียน</div>}
        </div>
        <div className="min-w-0 flex-1 text-center">
          <h3 className="truncate text-[16px] font-bold">{template.schoolName || "ชื่อโรงเรียน"}</h3>
          <p className="mt-1 truncate text-[12px]">{template.examTitle || "ชื่อแบบทดสอบ"}</p>
          <p className="mt-1 truncate text-[11px]">วิชา {template.subject || "________________"} · ชั้น {template.classLabel || "________"}</p>
        </div>
        {showQr && (
          <div className="flex w-16 shrink-0 flex-col items-center text-center text-[8px] text-gray-600">
            {qrUrl ? <img src={qrUrl} alt="QR ประจำตัวนักเรียน" className="h-14 w-14 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded border text-[9px]">QR</div>}
            <span className="mt-0.5">ประจำตัว</span>
          </div>
        )}
      </header>

      <section className="absolute left-[52px] right-[52px] top-[145px] grid h-[48px] grid-cols-3 grid-rows-2 gap-x-5 gap-y-1 border-y border-black py-1 text-[11px]">
        <div className="truncate">ชื่อ-สกุล: <strong>{student.name || "________________"}</strong></div>
        <div className="truncate">รหัสนักเรียน: <strong>{student.studentNo || "__________"}</strong></div>
        <div className="truncate">เลขที่: <strong>{student.rollNo || "____"}</strong></div>
        <div className="truncate">ห้อง: {template.classLabel || "________"}</div>
        <div>วันที่สอบ: ____ / ____ / ______</div>
        <div className="truncate">วิชา: {template.subject || "____________"}</div>
      </section>

      <section className="absolute left-[52px] right-[52px] top-[207px] h-[60px] rounded border border-black px-3 py-2 text-[10px] leading-[15px]">
        <p className="font-bold">คำชี้แจง</p>
        <p>1. ระบายวงกลมให้ทึบเต็มวงด้วยดินสอ 2B เพียงหนึ่งตัวเลือกต่อข้อ</p>
        <p>2. หากเปลี่ยนคำตอบ ให้ลบคำตอบเดิมให้สะอาด และห้ามทำเครื่องหมายบนสี่เหลี่ยมดำ 4 มุม</p>
      </section>

      <div data-omr-grid="v1" className="absolute flex" style={{ left: OMR_GRID.left - 1, top: OMR_GRID.top, gap: OMR_GRID.columnGap }}>
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="overflow-hidden border border-black" style={{ width: OMR_GRID.tableWidth }} data-omr-column={colIndex}>
            <div className="grid border-b border-black bg-gray-50 text-center text-[9px] font-bold" style={{ ...choiceGridStyle, height: OMR_GRID.headerHeight }}>
              <div className="border-r border-black">ข้อ</div>
              {choiceLabels.map((label) => <div key={label}>{label}</div>)}
            </div>
            {column.map((questionNumber) => (
              <div key={questionNumber} data-omr-question={questionNumber} className="grid border-b border-gray-300 text-center text-[9px]" style={{ ...choiceGridStyle, height: OMR_GRID.rowHeight, lineHeight: `${OMR_GRID.rowHeight}px` }}>
                <div className="border-r border-gray-300">{questionNumber}</div>
                {choiceLabels.map((choice, choiceIndex) => (
                  <div key={choice} className="flex items-center justify-center" style={{ height: OMR_GRID.rowHeight }}>
                    <span
                      data-omr-bubble="true"
                      data-omr-question-number={questionNumber}
                      data-omr-choice={choice}
                      aria-label={`ช่องคำตอบข้อ ${questionNumber} ตัวเลือก ${choice}`}
                      className="block rounded-full border-[1.5px] border-black" style={{ width: OMR_GRID.bubbleDiameter, height: OMR_GRID.bubbleDiameter }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <footer className="absolute left-[52px] right-[52px] top-[1024px] border-t border-black pt-2 text-[9px] text-gray-600">
        <p>{showQr ? "OMR FORM V1 · QR ใช้ระบุตัวนักเรียนเท่านั้น ไม่ใช่ผลการตรวจคำตอบ" : "กระดาษคำตอบแบบธรรมดา · ไม่มี QR ระบุตัวนักเรียน"} · {questions.length} ข้อ · {choiceLabels.length} ตัวเลือก</p>
      </footer>
    </div>
  );
}
