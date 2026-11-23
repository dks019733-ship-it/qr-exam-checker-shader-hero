"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, ExternalLink, FileSpreadsheet, Loader2, Plus, RefreshCw } from "lucide-react";
import { GeneratedMaterial, materialsApi } from "@/lib/ai-api";

export function GoogleFormsManager() {
  const [materials, setMaterials] = useState<GeneratedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingId, setCreatingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewRequiredId, setReviewRequiredId] = useState("");
  const [needsGoogleReauth, setNeedsGoogleReauth] = useState(false);
  const [corrections, setCorrections] = useState<{ number: number; oldAnswer: string; newAnswer: string; reason: string }[]>([]);
  const [unresolvedQuestions, setUnresolvedQuestions] = useState<number[]>([]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const result = await materialsApi.list();
      setMaterials(result.materials.filter((item) => item.kind === "google_form" || Boolean(item.google_form)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดรายการข้อสอบไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createForm(material: GeneratedMaterial) {
    setCreatingId(material.id);
    setError("");
    setNotice("");
    setReviewRequiredId("");
    setNeedsGoogleReauth(false);
    setCorrections([]);
    setUnresolvedQuestions([]);
    try {
      const response = await fetch(`/api/ai/materials/${encodeURIComponent(material.id)}/google-form`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setNeedsGoogleReauth(body.action === "reauthorize");
      if (!response.ok && body.material) {
        setMaterials((current) => current.map((item) => item.id === material.id ? body.material : item));
        setReviewRequiredId(material.id);
        setCorrections(Array.isArray(body.corrections) ? body.corrections : []);
        setUnresolvedQuestions(Array.isArray(body.unresolved_question_numbers) ? body.unresolved_question_numbers : []);
        setError(body.error || "ข้อสอบต้องตรวจแก้และอนุมัติอีกครั้งก่อนสร้างฟอร์ม");
        return;
      }
      if (!response.ok) throw new Error(body.error || "สร้าง Google Forms ไม่สำเร็จ");
      setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, google_form: body.googleForm } : item));
      setReviewRequiredId("");
      setNeedsGoogleReauth(false);
      setCorrections([]);
      setUnresolvedQuestions([]);
      setNotice(`สร้าง Google Forms สำหรับ “${material.title}” แล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สร้าง Google Forms ไม่สำเร็จ");
    } finally {
      setCreatingId("");
    }
  }

  const formCount = useMemo(() => materials.filter((item) => item.google_form).length, [materials]);
  const approvedCount = useMemo(() => materials.filter((item) => item.status === "approved").length, [materials]);

  return (
    <main className="min-h-screen bg-[#f3f7f3] px-4 py-6 text-[#183b2b] sm:px-7 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-[28px] border border-[#dce9df] bg-white shadow-[0_16px_50px_-38px_rgba(19,60,39,.45)]">
          <div className="flex flex-col gap-5 bg-gradient-to-br from-[#173d2c] via-[#1d4b35] to-[#285c40] px-6 py-7 text-white sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[.18em] text-[#c6ddcb]"><FileSpreadsheet className="h-4 w-4" />ONLINE ASSESSMENT</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Google Forms</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#e0eee3]">สร้างแบบทดสอบออนไลน์ด้วย AI แยกจากข้อสอบกระดาษ ตรวจแก้และอนุมัติก่อนสร้าง Google Form</p>
            </div>
            <Link href="/dashboard/ai/materials?kind=google_form" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1b4932] transition hover:bg-[#edf5ee] sm:self-auto">สร้างฟอร์มด้วย AI <Plus className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#e7eee8] sm:grid-cols-3">
            <div className="px-6 py-5"><p className="text-xs text-[#708477]">แบบทดสอบออนไลน์</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : materials.length}</p></div>
            <div className="px-6 py-5"><p className="text-xs text-[#708477]">อนุมัติแล้ว</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : approvedCount}</p></div>
            <div className="col-span-2 border-t border-[#e7eee8] px-6 py-5 sm:col-span-1 sm:border-l sm:border-t-0"><p className="text-xs text-[#708477]">สร้างฟอร์มแล้ว</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : formCount}</p></div>
          </div>
        </header>

        <section className="mt-6 rounded-[24px] border border-[#dce9df] bg-white p-5 shadow-[0_12px_38px_-34px_rgba(19,60,39,.4)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Google Forms ของฉัน</h2><p className="mt-1 text-sm text-[#75867a]">แสดงเฉพาะแบบทดสอบออนไลน์ที่สร้างแยกจากข้อสอบกระดาษ</p></div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing || loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce9df] px-3 py-2 text-sm font-medium text-[#315b41] transition hover:bg-[#f3f8f4] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />รีเฟรช</button>
          </div>

          {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><p>{error}</p>{corrections.length > 0 && <ul className="mt-2 list-inside list-disc space-y-1">{corrections.map((item) => <li key={item.number}>ข้อ {item.number}: <span className="line-through">{item.oldAnswer}</span> → <strong>{item.newAnswer}</strong>{item.reason ? ` · ${item.reason}` : ""}</li>)}</ul>}{unresolvedQuestions.length > 0 && <p className="mt-2 font-medium">ข้อที่ยังต้องตรวจเอง: {unresolvedQuestions.join(", ")}</p>}{reviewRequiredId && <Link href={`/dashboard/ai/materials/${reviewRequiredId}`} className="mt-2 inline-flex font-semibold underline">เปิดข้อสอบเพื่อตรวจแก้และอนุมัติอีกครั้ง</Link>}{needsGoogleReauth && <button type="button" onClick={() => void signIn("google", { redirectTo: window.location.href })} className="mt-2 block rounded-lg border border-red-300 bg-white px-3 py-2 font-medium hover:bg-red-100">เชื่อมบัญชี Google ใหม่</button>}</div>}
          {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-[#cfe5d4] bg-[#f1f8f2] px-4 py-3 text-sm text-[#245238]"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p>}

          {loading ? (
            <div className="mt-5 space-y-3" aria-label="กำลังโหลดข้อสอบ">{[1,2,3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[#f0f5f0]" />)}</div>
          ) : materials.length ? (
            <div className="mt-5 space-y-3">
              {materials.map((material) => (
                <article key={material.id} className="flex flex-col gap-4 rounded-2xl border border-[#e5eee6] p-4 transition hover:border-[#b9d4bf] hover:bg-[#fbfdfb] sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${material.status === "approved" ? "bg-[#e8f4e9] text-[#28603b]" : "bg-[#fff4df] text-[#8a641e]"}`}>{material.status === "approved" ? "อนุมัติแล้ว" : "รอครูตรวจ"}</span>
                      {material.google_form && <span className="rounded-full bg-[#edf4f0] px-2.5 py-1 text-[11px] font-semibold text-[#476451]">เชื่อม Google Forms แล้ว</span>}
                    </div>
                    <h3 className="mt-2 truncate text-base font-semibold text-[#203e2d]">{material.title}</h3>
                    <p className="mt-1 text-xs text-[#7b8a7e]">{material.subject} · {material.grade_level} · {material.content.questions?.length || 0} ข้อ</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={`/dashboard/ai/materials/${material.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#dce9df] px-3 py-2 text-xs font-semibold text-[#345a40] hover:bg-[#f1f7f2]">ตรวจแบบทดสอบ</Link>
                    {material.google_form ? (
                      <>
                        <a href={material.google_form.responder_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1d4b35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#163d2b]">ลิงก์นักเรียน <ExternalLink className="h-3.5 w-3.5" /></a>
                        <a href={material.google_form.edit_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#dce9df] px-3 py-2 text-xs font-semibold text-[#345a40] hover:bg-[#f1f7f2]">แก้ไขฟอร์ม</a>
                      </>
                    ) : material.status === "approved" ? (
                      <button type="button" onClick={() => void createForm(material)} disabled={creatingId === material.id} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#1d4b35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#163d2b] disabled:opacity-60">{creatingId === material.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}สร้าง Google Forms</button>
                    ) : <span className="inline-flex items-center rounded-xl bg-[#f6f5f0] px-3 py-2 text-xs text-[#7c806f]">ต้องอนุมัติข้อสอบก่อน</span>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d5e4d8] bg-[#f8fbf8] px-5 py-12 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-[#75917b]" />
              <h3 className="mt-3 font-semibold text-[#294a34]">ยังไม่มีแบบทดสอบออนไลน์</h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#78877b]">เริ่มสร้างแบบทดสอบออนไลน์ด้วย AI ได้ที่หน้านี้ โดยตรวจคำถามและเฉลยก่อนอนุมัติและสร้าง Google Forms</p>
              <Link href="/dashboard/ai/materials?kind=google_form" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d4b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163d2b]">สร้างแบบทดสอบด้วย AI <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
