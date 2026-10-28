"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GeneratedMaterial, MaterialKind, materialsApi } from "@/lib/ai-api";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
const learningAreas = ["ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี", "สังคมศึกษา ศาสนา และวัฒนธรรม", "สุขศึกษาและพลศึกษา", "ศิลปะ", "การงานอาชีพ", "ภาษาต่างประเทศ"];

export default function MaterialsPage() {
  const router = useRouter();
  const [kind, setKind] = useState<MaterialKind>("exam");
  const [materials, setMaterials] = useState<GeneratedMaterial[]>([]);
  const [subject, setSubject] = useState("");
  const [defaultLearningArea, setDefaultLearningArea] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("ปานกลาง");
  const [documentType, setDocumentType] = useState("ใบงาน");
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const selectedKind = new URLSearchParams(window.location.search).get("kind");
    if (selectedKind === "document") setKind("document");
    materialsApi.list().then(({ materials: rows }) => setMaterials(rows)).catch((err) => setPageError(err.message));
    fetch("/api/teacher-settings").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "โหลดกลุ่มสาระประจำครูไม่สำเร็จ");
      const area = typeof data.defaultLearningArea === "string" ? data.defaultLearningArea : "";
      setDefaultLearningArea(area);
      setSubject((current) => current || area);
    }).catch((error) => setSettingsMessage(error instanceof Error ? error.message : "โหลดกลุ่มสาระประจำครูไม่สำเร็จ"));
  }, []);

  async function saveDefaultLearningArea() {
    setSavingArea(true); setSettingsMessage("");
    try {
      const response = await fetch("/api/teacher-settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ defaultLearningArea: subject }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "บันทึกกลุ่มสาระไม่สำเร็จ");
      setDefaultLearningArea(data.defaultLearningArea || "");
      setSettingsMessage("บันทึกกลุ่มสาระประจำครูแล้ว จะใช้เป็นค่าเริ่มต้นสำหรับงานและฟอร์มที่สร้างใหม่");
    } catch (error) { setSettingsMessage(error instanceof Error ? error.message : "บันทึกกลุ่มสาระไม่สำเร็จ"); }
    finally { setSavingArea(false); }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    try {
      const { material } = await materialsApi.generate({
        kind,
        subject,
        gradeLevel,
        topic,
        learningObjectives: objectives,
        difficulty,
        ...(kind === "exam"
          ? { questionCount, questionTypes: ["ปรนัย", "อัตนัยสั้น"] }
          : { documentType }),
      });
      router.push(`/dashboard/ai/materials/${material.id}`);
    } catch (err: any) {
      setPageError(err.message || "สร้างร่างไม่สำเร็จ");
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (!selectedIds.length || !window.confirm(`ลบงาน ${selectedIds.length} รายการออกจากระบบหรือไม่? Google Forms ที่สร้างไว้ยังอยู่ใน Drive`)) return;
    setLoading(true);
    try {
      const response = await fetch("/api/ai/materials", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selectedIds }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ลบงานไม่สำเร็จ");
      setMaterials((rows) => rows.filter((row) => !selectedIds.includes(row.id))); setSelectedIds([]); setPageError("");
    } catch (error) { setPageError(error instanceof Error ? error.message : "ลบงานไม่สำเร็จ"); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-[#f7f6f0] px-4 py-6 text-[#303832] sm:px-8 sm:py-8">
      <header className="mb-7 flex items-center justify-between">
        <div>
          <button onClick={() => router.push("/dashboard/ai")} className="mb-3 text-sm text-[#5c7057] hover:underline">← ผู้ช่วย AI</button>
          <h1 className="text-2xl font-semibold text-slate-900">สร้างข้อสอบและเอกสาร</h1>
          <p className="mt-1 text-sm text-slate-500">AI จะสร้างเป็นร่างให้ครูตรวจ แก้ไข และอนุมัติก่อนใช้งาน</p>
          {kind === "exam" && <p className="mt-2 text-sm text-emerald-800">หลังอนุมัติข้อสอบ จะมีปุ่มสร้าง Google Forms พร้อมเฉลยและลิงก์สำหรับส่งให้นักเรียนในหน้าข้อสอบ</p>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <form onSubmit={handleGenerate} className="space-y-4 rounded-3xl border border-[#e2e6de] bg-[#fffefa] p-5 shadow-sm sm:p-6">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setKind("exam")} className={`rounded-lg px-3 py-2 text-sm font-medium ${kind === "exam" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}>ข้อสอบ</button>
            <button type="button" onClick={() => setKind("document")} className={`rounded-lg px-3 py-2 text-sm font-medium ${kind === "document" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}>เอกสาร</button>
          </div>

          <div className="rounded-2xl border border-[#e2e6de] bg-[#f7f6f0] p-4">
            <label className="block text-sm font-medium text-slate-700">กลุ่มสาระ / วิชา<input required list="learning-area-options" maxLength={160} value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass} placeholder="เช่น วิทยาศาสตร์และเทคโนโลยี" /></label>
            <datalist id="learning-area-options">{learningAreas.map((area) => <option key={area} value={area} />)}</datalist>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">ค่าเริ่มต้นประจำครู: {defaultLearningArea || "ยังไม่ได้ตั้ง"} · แก้ไขได้ทุกครั้งก่อนสร้าง</p><button type="button" onClick={() => void saveDefaultLearningArea()} disabled={savingArea || !subject.trim() || subject === defaultLearningArea} className="rounded-lg border border-[#d9dfd5] bg-white px-3 py-1.5 text-xs font-medium text-[#425a49] disabled:opacity-50">{savingArea ? "กำลังบันทึก..." : "ตั้งเป็นกลุ่มสาระประจำครู"}</button></div>
            {settingsMessage && <p role="status" className="mt-2 text-xs text-[#425a49]">{settingsMessage}</p>}
          </div>
          <label className="block text-sm font-medium text-slate-700">ระดับชั้น<input required maxLength={160} value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={fieldClass} placeholder="เช่น ป.6" /></label>
          <label className="block text-sm font-medium text-slate-700">หัวข้อ<input required maxLength={160} value={topic} onChange={(e) => setTopic(e.target.value)} className={fieldClass} placeholder="เช่น ระบบสุริยะ" /></label>
          <label className="block text-sm font-medium text-slate-700">ตัวชี้วัดหรือจุดประสงค์<textarea rows={3} maxLength={3000} value={objectives} onChange={(e) => setObjectives(e.target.value)} className={fieldClass} placeholder="ระบุสิ่งที่ต้องการให้นักเรียนรู้หรือทำได้" /></label>

          {kind === "exam" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">จำนวนข้อ (1–40)<input required type="number" min={1} max={40} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className={fieldClass} /></label>
              <label className="block text-sm font-medium text-slate-700">ความยาก<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={fieldClass}><option>ง่าย</option><option>ปานกลาง</option><option>ยาก</option></select></label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">ประเภทเอกสาร<select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={fieldClass}><option>ใบงาน</option><option>แผนการจัดการเรียนรู้</option><option>เอกสารประกอบการสอน</option></select></label>
              <label className="block text-sm font-medium text-slate-700">รายละเอียดเพิ่มเติม<input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={fieldClass} /></label>
            </div>
          )}

          {pageError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-[#5c7057] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4b6048] disabled:cursor-wait disabled:opacity-60">{loading ? "กำลังสร้างร่าง..." : "สร้างร่างเพื่อให้ครูตรวจ"}</button>
          <p className="text-xs leading-5 text-slate-500">ห้ามนำเนื้อหาไปใช้กับนักเรียนจนกว่าจะตรวจและกดอนุมัติ</p>
        </form>

        <section className="rounded-3xl border border-[#e2e6de] bg-[#fffefa] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-900">งานที่สร้างไว้</h2><p className="mt-1 text-sm text-slate-500">เลือกงานเพื่อลบหลายรายการพร้อมกันได้</p></div>{selectedIds.length > 0 && <button onClick={() => void deleteSelected()} disabled={loading} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">ลบที่เลือก ({selectedIds.length})</button>}</div>
          <div className="mt-4 space-y-3">
            {materials.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/30"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} aria-label={`เลือก ${item.title} เพื่อลบ`} className="!w-4 !min-w-4 !p-0 !m-0 mt-1 shrink-0" /><button onClick={() => router.push(`/dashboard/ai/materials/${item.id}`)} className="min-w-0 flex-1 text-left">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{item.status === "approved" ? "อนุมัติแล้ว" : "รอครูตรวจ"}</span>
                <h3 className="mt-3 font-medium text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.subject} · {item.grade_level} · {item.kind === "exam" ? "ข้อสอบ" : "เอกสาร"}</p>
              </button></div>
            ))}
            {!materials.length && !pageError && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">ยังไม่มีงานที่สร้างไว้</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
