"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Download, Save } from "lucide-react";

type UnreceivedStudent = { id: string; rollNo: string; studentNo: string; name: string };

type Submission = {
  id: string;
  status: string;
  submittedAt: string;
  isLate: boolean;
  score: number | null;
  feedback: string;
  student: { id: string; rollNo: string; studentNo: string; name: string };
  files: { id: string; fileName: string; contentType: string; sizeBytes: number }[];
};

export function AssignmentSubmissionReview({ assignmentId }: { assignmentId: string }) {
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [unreceived, setUnreceived] = useState<UnreceivedStudent[]>([]);
  const [mode, setMode] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignments/" + assignmentId + "/submissions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดรายการส่งงานไม่สำเร็จ");
      setTitle(data.assignment.title);
      setMode(data.assignment.mode);
      setMaxScore(data.assignment.maxScore);
      setUnreceived(data.unreceivedStudents || []);
      setSubmissions(data.submissions);
      setDrafts(Object.fromEntries(data.submissions.map((item: Submission) => [item.id, {
        score: item.score === null ? "" : String(item.score),
        feedback: item.feedback || "",
      }])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [assignmentId]);

  async function save(item: Submission) {
    const draft = drafts[item.id];
    if (!draft) return;
    const score = draft.score.trim() === "" ? null : Number(draft.score);
    if (score !== null && (!Number.isFinite(score) || score < 0 || (maxScore !== null && score > maxScore))) {
      setError("คะแนนต้องอยู่ระหว่าง 0 ถึงคะแนนเต็ม");
      return;
    }
    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/assignments/" + assignmentId + "/submissions/" + item.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback: draft.feedback }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกผลตรวจไม่สำเร็จ");
      setNotice("บันทึกผลตรวจของ " + item.student.name + " แล้ว");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingId("");
    }
  }

  async function openFile(fileId: string) {
    const response = await fetch("/api/files/download?kind=submission&fileId=" + encodeURIComponent(fileId));
    const data = await response.json();
    if (response.ok && data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    else setError(data.error || "เปิดไฟล์ไม่สำเร็จ");
  }

  return (
    <main className="min-h-screen bg-[#f8f7f4] px-4 py-8 text-[#1c241b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71816c]">SUBMISSION REVIEW</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">ตรวจงานและให้คะแนน</h1><p className="mt-2 text-sm text-[#687565]">{title || "กำลังโหลดงาน..."}</p></header>
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {mode === "TEACHER_CHECK" && !loading && unreceived.length > 0 && (
          <section className="rounded-2xl border border-[#e6e8df] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-bold">ยังไม่ได้บันทึกว่าส่งกับครู ({unreceived.length} คน)</h2>
            <p className="mt-1 text-xs text-[#788174]">เมื่อนักเรียนนำสมุดหรือกระดาษมาส่ง ให้กดรับงานเพื่อบันทึกเวลาที่ครูตรวจรับ</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {unreceived.map((student) => (
                <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0e9] px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold">{student.name}</p><p className="text-[11px] text-[#788174]">เลขที่ {student.rollNo || "—"} · {student.studentNo}</p></div>
                  <button type="button" onClick={async () => {
                    const response = await fetch("/api/assignments/" + assignmentId + "/submissions", {
                      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: student.id }),
                    });
                    const data = await response.json();
                    if (!response.ok) setError(data.error || "บันทึกการรับงานไม่สำเร็จ");
                    else { setNotice("บันทึกการรับงานของ " + student.name + " แล้ว"); await load(); }
                  }} className="shrink-0 rounded-lg bg-[#4d5f4a] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#374535]">รับงานแล้ว</button>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="overflow-hidden rounded-2xl border border-[#e6e8df] bg-white shadow-sm">
          {loading ? <p className="p-12 text-center text-sm text-[#788174]">กำลังโหลดรายการส่งงาน...</p> : submissions.length === 0 ? <p className="p-12 text-center text-sm text-[#788174]">ยังไม่มีนักเรียนส่งงาน</p> : <div className="divide-y divide-[#edf0e9]">{submissions.map((item) => <article key={item.id} className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div><p className="text-sm font-bold">{item.student.name}</p><p className="mt-1 text-xs text-[#788174]">เลขที่ {item.student.rollNo || "—"} · รหัส {item.student.studentNo}</p><p className="mt-1 text-xs text-[#788174]">ส่งเมื่อ {new Date(item.submittedAt).toLocaleString("th-TH")} {item.isLate && <span className="font-bold text-rose-700">· ส่งล่าช้า</span>}</p></div>
              <span className="w-fit rounded-lg bg-[#f0f3eb] px-2.5 py-1 text-xs font-semibold text-[#4d5f4a]">{item.status === "REVIEWED" ? "ตรวจแล้ว" : "รอตรวจ"}</span>
            </div>
            {item.files.length > 0 && <div className="flex flex-wrap gap-2">{item.files.map((file) => <button key={file.id} type="button" onClick={() => openFile(file.id)} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe4d8] px-3 py-2 text-xs font-semibold text-[#4d5f4a] hover:bg-[#f8f9f6]"><Download className="h-3.5 w-3.5" />{file.fileName}</button>)}</div>}
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#687565]">คะแนน {maxScore !== null ? "(เต็ม " + maxScore + ")" : ""}</span><input type="number" min="0" max={maxScore ?? undefined} step="0.5" value={drafts[item.id]?.score ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], score: event.target.value } }))} className="min-h-10 w-full rounded-lg border border-[#dfe4d8] px-3 text-sm" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#687565]">ความคิดเห็นครู</span><input maxLength={5000} value={drafts[item.id]?.feedback ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], feedback: event.target.value } }))} placeholder="ข้อเสนอแนะเพิ่มเติม..." className="min-h-10 w-full rounded-lg border border-[#dfe4d8] px-3 text-sm" /></label>
              <button type="button" disabled={savingId === item.id} onClick={() => save(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#4d5f4a] px-4 text-xs font-bold text-white hover:bg-[#374535] disabled:opacity-50"><Save className="h-3.5 w-3.5" />{savingId === item.id ? "กำลังบันทึก" : "บันทึกผลตรวจ"}</button>
            </div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
}
