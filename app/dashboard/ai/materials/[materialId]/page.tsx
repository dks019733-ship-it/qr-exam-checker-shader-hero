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
  const [googleForm, setGoogleForm] = useState<GeneratedMaterial["google_form"]>(null);
  const [creatingForm, setCreatingForm] = useState(false);
  const [correctionNotice, setCorrectionNotice] = useState("");
  const [corrections, setCorrections] = useState<{ number: number; oldAnswer: string; newAnswer: string; reason: string }[]>([]);
  const [unresolvedQuestions, setUnresolvedQuestions] = useState<number[]>([]);
  const locked = material?.status === "approved";

  useEffect(() => {
    materialsApi.get(params.materialId)
      .then(({ material: row }) => {
        setMaterial(row);
        setTitle(row.title);
        const reviewedContent = row.content || {};
        setContent(row.kind === "exam" && reviewedContent.questions
          ? { ...reviewedContent, totalPoints: reviewedContent.questions.length, questions: reviewedContent.questions.map((question) => ({ ...question, points: 1 })) }
          : reviewedContent);
        setReviewNotes(row.review_notes || "");
        setGoogleForm(row.google_form || null);
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
      setCorrectionNotice("");
      setCorrections([]);
      setUnresolvedQuestions([]);
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

  async function createGoogleForm() {
    if (!material) return;
    setCreatingForm(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/materials/${encodeURIComponent(material.id)}/google-form`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok && body.material) {
        setMaterial(body.material);
        setTitle(body.material.title);
        setContent(body.material.content || {});
        setReviewNotes(body.material.review_notes || "");
        setCorrections(body.corrections || []);
        setUnresolvedQuestions(body.unresolved_question_numbers || []);
        setCorrectionNotice(body.error || "AI เสนอแก้เฉลยแล้ว กรุณาตรวจและอนุมัติอีกครั้ง");
        return;
      }
      if (!response.ok) throw new Error(body.error || "สร้าง Google Form ไม่สำเร็จ");
      setGoogleForm(body.googleForm);
      setCorrectionNotice("");
    } catch (err: any) {
      setError(err.message || "สร้าง Google Form ไม่สำเร็จ");
    } finally {
      setCreatingForm(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">กำลังโหลด...</div>;
  if (!material) return <main className="mx-auto max-w-3xl p-8"><p role="alert" className="text-sm text-red-700">{error || "ไม่พบชิ้นงาน"}</p><button onClick={() => router.push("/dashboard/ai/materials")} className="mt-4 text-sm text-brand-700">← กลับไปหน้างานของฉัน</button></main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8 sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push("/dashboard/ai/materials")} className="text-sm text-brand-700 hover:underline">← กลับไปงานของฉัน</button>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{locked ? "ครูอนุมัติแล้ว" : "รอครูตรวจสอบ"}</span>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <p className="mb-2 text-sm font-medium text-brand-700">{material.kind === "exam" ? "ข้อสอบ" : material.document_type || "เอกสาร"} · {material.subject} · {material.grade_level}</p>
        <input aria-label="ชื่อชิ้นงาน" disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mb-4 text-2xl font-semibold`} />
        <p className="mb-5 text-sm text-slate-500">หัวข้อ: {material.topic}</p>
        {content.overview !== undefined && <label className="mb-5 block text-sm font-medium text-slate-700">ภาพรวม<textarea disabled={locked} rows={3} value={content.overview || ""} onChange={(e) => setContent((current) => ({ ...current, overview: e.target.value }))} className={`${inputClass} mt-1`} /></label>}

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
            {(content.sections || []).map((section, index) => (
              <section key={index} className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid print:border-0 print:p-0">
                <input aria-label={`หัวข้อส่วนที่ ${index + 1}`} disabled={locked} value={section.heading || ""} onChange={(e) => updateSection(index, { heading: e.target.value })} className={`${inputClass} text-lg font-semibold`} />
                <textarea aria-label={`เนื้อหาส่วนที่ ${index + 1}`} disabled={locked} rows={6} value={section.body || ""} onChange={(e) => updateSection(index, { body: e.target.value })} className={`${inputClass} mt-2`} />
              </section>
            ))}
            {!locked && <button onClick={() => setContent((current) => ({ ...current, sections: [...(current.sections || []), { heading: "หัวข้อใหม่", body: "" }] }))} className="no-print rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">+ เพิ่มหัวข้อ</button>}
          </div>
        )}

        {material.learning_objectives && <p className="mt-6 text-sm text-slate-600">จุดประสงค์ที่ระบุ: {material.learning_objectives}</p>}
        {!locked && <label className="no-print mt-6 block text-sm font-medium text-slate-700">หมายเหตุการตรวจ<textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className={`${inputClass} mt-1`} placeholder="จดสิ่งที่แก้ไขหรือควรตรวจเพิ่มเติม" /></label>}
        {error && <p role="alert" className="no-print mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {correctionNotice && <section role="status" className="no-print mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">ตรวจเฉลยที่ AI ปรับก่อนอนุมัติใหม่</p>
          <p className="mt-1">{correctionNotice}</p>
          {corrections.length > 0 && <ul className="mt-2 list-inside list-disc space-y-1">{corrections.map((item) => <li key={item.number}>ข้อ {item.number}: <span className="line-through">{item.oldAnswer}</span> → <strong>{item.newAnswer}</strong>{item.reason ? ` · ${item.reason}` : ""}</li>)}</ul>}
          {unresolvedQuestions.length > 0 && <p className="mt-2 font-medium">ข้อที่ยังต้องแก้เอง: {unresolvedQuestions.join(", ")}</p>}
        </section>}

        <div className="no-print mt-7 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          {!locked ? <>
            <button disabled={saving} onClick={() => save("pending_review")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึกฉบับตรวจแก้"}</button>
            <button disabled={saving} onClick={() => save("approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "กำลังบันทึก..." : "ตรวจแล้ว อนุมัติและล็อกฉบับนี้"}</button>
          </> : <>
            <button onClick={downloadDocx} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">ดาวน์โหลด Word (.docx)</button>
            <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">พิมพ์ / บันทึกเป็น PDF</button>
            {material.kind === "exam" && !googleForm && <button disabled={creatingForm} onClick={createGoogleForm} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{creatingForm ? "กำลังสร้าง Google Form..." : "สร้าง Google Form ให้นักเรียนทำ"}</button>}
            <p className="self-center text-xs text-slate-500">ในหน้าต่างพิมพ์ เลือก “บันทึกเป็น PDF”</p>
          </>}
        </div>
        {googleForm && <section className="no-print mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-900">Google Form พร้อมส่งให้นักเรียน</h2>
          <p className="mt-1 text-sm text-emerald-800">หน้าแรกให้นักเรียนกรอกเลขที่ ห้อง และชื่อ-นามสกุล จากนั้นกด “ถัดไป” เพื่อไปทำข้อสอบ ซึ่งจะตรวจคะแนนอัตโนมัติ</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a href={googleForm.responder_url} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white">เปิดลิงก์สำหรับนักเรียน</a>
            <a href={googleForm.edit_url} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300 px-3 py-2 font-medium text-emerald-900">แก้ไขใน Google Forms</a>
          </div>
          <p className="mt-3 break-all text-xs text-emerald-900">{googleForm.responder_url}</p>
        </section>}
      </article>
    </main>
  );
}
