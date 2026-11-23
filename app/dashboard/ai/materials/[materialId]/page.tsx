"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GeneratedMaterial, MaterialContent, materialsApi } from "@/lib/ai-api";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-slate-800 disabled:opacity-100";

export default function MaterialReviewPage() {
  const router = useRouter();
  const params = useParams<{ materialId: string }>();
  const [material, setMaterial] = useState<GeneratedMaterial | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<MaterialContent>({});
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const locked = material?.status === "approved";
  const cuteWorksheet = material?.kind === "document" && material.document_type === "ใบงาน" && content.worksheetStyle !== "editable";

  useEffect(() => {
    materialsApi.get(params.materialId)
      .then(({ material: row }) => {
        setMaterial(row);
        setTitle(row.title);
        const reviewedContent = row.content || {};
        setContent(row.kind === "exam" && reviewedContent.questions
          ? { ...reviewedContent, totalPoints: reviewedContent.questions.length, questions: reviewedContent.questions.map((question) => ({ ...question, points: 1 })) }
          : row.kind === "document" && row.document_type === "ใบงาน"
            ? { ...reviewedContent, worksheetStyle: reviewedContent.worksheetStyle || "cute" }
            : reviewedContent);
        setReviewNotes(row.review_notes || "");
      })
      .catch((err) => setError(err.message || "โหลดชิ้นงานไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [params.materialId]);

  function updateQuestion(index: number, patch: Record<string, unknown>) {
    setContent((current) => ({
      ...current,
      questions: (current.questions || []).map((question, i) => i === index ? { ...question, ...patch } : question),
    }));
  }

  function updateSection(index: number, patch: Record<string, unknown>) {
    setContent((current) => ({
      ...current,
      sections: (current.sections || []).map((section, i) => i === index ? { ...section, ...patch } : section),
    }));
  }

  async function save(status: "pending_review" | "approved") {
    if (!material) return;
    setSaving(true);
    setError("");
    try {
      const { material: saved } = await materialsApi.review(material.id, { title, content, reviewNotes, status });
      setMaterial(saved);
      setTitle(saved.title);
      setContent(saved.content);
      setReviewNotes(saved.review_notes || "");
    } catch (err: any) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocx() {
    if (!material) return;
    try {
      const blob = await materialsApi.exportDocx(material.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.replace(/[\\/:*?"<>|]/g, "-")}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "ดาวน์โหลด Word ไม่สำเร็จ");
    }
  }


  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">กำลังโหลด...</div>;
  if (!material) return <main className="mx-auto max-w-3xl p-8"><p role="alert" className="text-sm text-red-700">{error || "ไม่พบชิ้นงาน"}</p><button onClick={() => router.push("/dashboard/ai")} className="mt-4 text-sm text-brand-700">← กลับไปหน้างานของฉัน</button></main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8 sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push(material.kind === "document" ? "/dashboard/documents" : "/dashboard/exams")} className="text-sm text-brand-700 hover:underline">← กลับไปหน้าจัดการ{material.kind === "document" ? "เอกสาร" : "ข้อสอบ"}</button>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{locked ? "ครูอนุมัติแล้ว" : "รอครูตรวจสอบ"}</span>
      </div>

      <article className={`worksheet-paper rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none ${cuteWorksheet ? "worksheet-paper-cute" : ""}`}>
        {material.kind === "document" && material.document_type === "ใบงาน" && (
          <div className={`worksheet-banner no-print mb-5 rounded-2xl border p-4 ${cuteWorksheet ? "worksheet-banner-cute" : "worksheet-banner-formal"}`}>
            <p className="text-sm font-bold">{cuteWorksheet ? "ใบงานฉบับน่ารัก · สำหรับพิมพ์เป็น PDF" : "ใบงานฉบับจริงจัง · ดาวน์โหลด Word เพื่อแก้ไขต่อ"}</p>
            <p className="mt-1 text-xs">จัดรูปแบบเป็นใบงานสำหรับนักเรียน มีช่องข้อมูล คำชี้แจง กิจกรรมเป็นข้อ และพื้นที่เขียนคำตอบ ครูตรวจแก้ก่อนอนุมัติได้</p>
          </div>
        )}
        {cuteWorksheet && (
          <div className="worksheet-cute-top mb-5 rounded-2xl border-2 p-5">
            <p className="text-center text-xs font-bold tracking-[0.18em]">ใบงาน · LEARNING WORKSHEET</p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold">{material.subject} · {material.grade_level}</p>
                <input aria-label="ชื่อใบงาน" disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mt-2 border-0 bg-transparent px-0 text-2xl font-bold`} />
                <p className="mt-1 text-sm">หัวข้อ: {material.topic}</p>
              </div>
              <span className="worksheet-cute-sticker rounded-full px-3 py-2 text-sm font-bold">ลงมือทำกัน!</span>
            </div>
            <div className="worksheet-student-fields mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <span className="col-span-2">ชื่อ-นามสกุล ______________________________</span>
              <span>ชั้น _____________</span><span>เลขที่ _____________</span>
              <span>วันที่ ______ / ______ / ______</span>
            </div>
          </div>
        )}
        <p className={`mb-2 text-sm font-medium text-brand-700 ${cuteWorksheet ? "print:hidden" : ""}`}>{material.kind === "exam" ? "ข้อสอบ" : material.document_type || "เอกสาร"} · {material.subject} · {material.grade_level}</p>
        {!cuteWorksheet && <input aria-label="ชื่อชิ้นงาน" disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mb-4 text-2xl font-semibold`} />}
        {!cuteWorksheet && <p className="mb-5 text-sm text-slate-500">หัวข้อ: {material.topic}</p>}
        {!!content.overview?.trim() && <label className="mb-5 block text-sm font-medium text-slate-700">ภาพรวม<textarea disabled={locked} rows={3} value={content.overview || ""} onChange={(e) => setContent((current) => ({ ...current, overview: e.target.value }))} className={`${inputClass} mt-1`} /></label>}

        {material.kind === "exam" ? (
          <>
            <label className="mb-5 block text-sm font-medium text-slate-700">คำชี้แจง<textarea disabled={locked} rows={2} value={content.instructions || ""} onChange={(e) => setContent((current) => ({ ...current, instructions: e.target.value }))} className={`${inputClass} mt-1`} /></label>
            <div className="space-y-5">
              {(content.questions || []).map((question, index) => (
                <section key={index} className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid print:border-0 print:p-0">
                  <label className="block text-sm font-semibold text-slate-800">ข้อ {question.number} · {question.type}<textarea disabled={locked} rows={3} value={question.prompt || ""} onChange={(e) => updateQuestion(index, { prompt: e.target.value })} className={`${inputClass} mt-1 font-normal`} /></label>
                  {(question.choices || []).map((choice, choiceIndex) => <input key={choiceIndex} aria-label={`ตัวเลือก ${choiceIndex + 1}`} disabled={locked} value={choice} onChange={(e) => updateQuestion(index, { choices: (question.choices || []).map((item, i) => i === choiceIndex ? e.target.value : item) })} className={`${inputClass} mt-2`} />)}
                  <label className="mt-3 block text-sm font-medium text-slate-700">เฉลย<input disabled={locked} value={question.answer || ""} onChange={(e) => updateQuestion(index, { answer: e.target.value })} className={`${inputClass} mt-1`} /></label>
                  <label className="mt-3 block text-sm font-medium text-slate-700">เหตุผล/คำอธิบาย<textarea disabled={locked} rows={2} value={question.rationale || ""} onChange={(e) => updateQuestion(index, { rationale: e.target.value })} className={`${inputClass} mt-1`} /></label>
                  <p className="mt-3 text-sm text-slate-600">คะแนนข้อนี้: 1 คะแนน</p>
                </section>
              ))}
            </div>
            <p className="mt-4 text-right text-sm font-semibold">คะแนนรวม: {content.questions?.length || 0} คะแนน (ข้อละ 1 คะแนน)</p>
          </>
        ) : (
          <div className="space-y-5">
            {material.document_type === "ใบงาน" && !cuteWorksheet && (
              <div className="worksheet-student-fields no-print grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4 text-sm sm:grid-cols-4">
                <label className="col-span-2">ชื่อ-นามสกุล <span className="worksheet-blank" /></label>
                <label>ชั้น <span className="worksheet-blank" /></label>
                <label>เลขที่ <span className="worksheet-blank" /></label>
                <label>วันที่ <span className="worksheet-blank" /></label>
              </div>
            )}
            {!!content.learningObjectives?.length && (
              <section className={`rounded-xl border p-4 ${cuteWorksheet ? "worksheet-instructions-cute" : "border-slate-200 bg-slate-50"}`}>
                <h2 className="text-sm font-bold">จุดประสงค์การเรียนรู้</h2>
                {!locked && <label className="no-print mt-2 block text-xs text-slate-600">แก้ไขได้ หนึ่งข้อขึ้นบรรทัดใหม่<textarea rows={Math.max(2, content.learningObjectives.length)} value={content.learningObjectives.join("\n")} onChange={(e) => setContent((current) => ({ ...current, learningObjectives: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) }))} className={`${inputClass} mt-1`} /></label>}
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6">
                  {content.learningObjectives.map((objective, index) => <li key={`${index}-${objective}`}>{objective}</li>)}
                </ul>
              </section>
            )}
            {content.instructions !== undefined && <label className={`block rounded-xl border p-4 text-sm font-medium ${cuteWorksheet ? "worksheet-instructions-cute" : "border-slate-200 bg-slate-50 text-slate-700"}`}>คำชี้แจง<textarea disabled={locked} rows={2} value={content.instructions || ""} onChange={(e) => setContent((current) => ({ ...current, instructions: e.target.value }))} className={`${inputClass} mt-1`} /></label>}
            {(content.sections || []).map((section, index) => (
              <section key={index} className={`worksheet-section rounded-xl border p-4 print:break-inside-avoid print:p-4 ${cuteWorksheet ? "worksheet-section-cute" : "border-slate-200"}`}>
                <div className="flex items-start gap-2">
                  {cuteWorksheet && <span className="worksheet-section-number flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">{index + 1}</span>}
                  <input aria-label={`หัวข้อส่วนที่ ${index + 1}`} disabled={locked} value={section.heading || ""} onChange={(e) => updateSection(index, { heading: e.target.value })} className={`${inputClass} text-lg font-semibold`} />
                </div>
                <textarea aria-label={`เนื้อหาส่วนที่ ${index + 1}`} disabled={locked} rows={2} value={section.body || ""} onChange={(e) => updateSection(index, { body: e.target.value })} className={`${inputClass} mt-2`} />
                {!locked && <label className="no-print mt-3 block text-xs font-medium text-slate-600">กิจกรรม / คำถาม (หนึ่งข้อขึ้นบรรทัดใหม่)<textarea disabled={locked} rows={Math.max(3, Math.min(8, section.items?.length || 3))} value={(section.items || []).join("\n")} onChange={(e) => updateSection(index, { items: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} className={`${inputClass} mt-1`} placeholder="1. สิ่งที่ให้นักเรียนทำหรือคำถามปลายเปิด" /></label>}
                {!!section.items?.length && <ol className="worksheet-activities mt-3 space-y-4 pl-6 text-sm leading-7">
                  {section.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`} className="worksheet-activity-item pl-1">
                    <span>{item}</span>
                    {Array.from({ length: Math.min(12, Math.max(0, section.responseLines ?? 3)) }, (_, line) => <div key={line} className="worksheet-answer-line h-7 border-b border-dotted border-slate-300" />)}
                  </li>)}
                </ol>}
                {!locked && <label className="no-print mt-3 inline-flex items-center gap-2 text-xs text-slate-600">จำนวนบรรทัดตอบต่อข้อ<input type="number" min={0} max={12} value={section.responseLines ?? 3} onChange={(e) => updateSection(index, { responseLines: Math.max(0, Math.min(12, Number(e.target.value))) })} className="!w-20 rounded-lg border px-2 py-1" /></label>}
              </section>
            ))}
            {!locked && <button onClick={() => setContent((current) => ({ ...current, sections: [...(current.sections || []), { heading: "หัวข้อใหม่", body: "" }] }))} className="no-print rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">+ เพิ่มหัวข้อ</button>}
          </div>
        )}

        {material.learning_objectives && <p className="mt-6 text-sm text-slate-600">จุดประสงค์ที่ระบุ: {material.learning_objectives}</p>}
        {!locked && <label className="no-print mt-6 block text-sm font-medium text-slate-700">หมายเหตุการตรวจ<textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className={`${inputClass} mt-1`} placeholder="จดสิ่งที่แก้ไขหรือควรตรวจเพิ่มเติม" /></label>}
        {error && <p role="alert" className="no-print mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="no-print mt-7 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          {!locked ? <>
            <button disabled={saving} onClick={() => save("pending_review")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึกฉบับตรวจแก้"}</button>
            <button disabled={saving} onClick={() => save("approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "กำลังบันทึก..." : "ตรวจแล้ว อนุมัติและล็อกฉบับนี้"}</button>
          </> : <>
            {(material.kind !== "document" || !cuteWorksheet) && <button onClick={downloadDocx} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">ดาวน์โหลด Word (.docx)</button>}
            {(material.kind !== "document" || cuteWorksheet) && <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{cuteWorksheet ? "พิมพ์ / บันทึกใบงาน PDF" : "พิมพ์ / บันทึกเป็น PDF"}</button>}
            {material.kind === "exam" && <button onClick={() => router.push("/dashboard/google-forms")} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">ไปจัดการ Google Forms</button>}
            {material.kind === "document" && material.document_type === "ใบงาน" && <p className="self-center text-xs text-slate-500">{cuteWorksheet ? "พิมพ์บนกระดาษ A4 แล้วเลือก “บันทึกเป็น PDF” เพื่อได้ใบงานพร้อมพิมพ์" : "ดาวน์โหลด Word เพื่อแก้ไขต่อ หรือพิมพ์เป็น PDF ได้เช่นกัน"}</p>}
          </>}
        </div>
      </article>
    </main>
  );
}
