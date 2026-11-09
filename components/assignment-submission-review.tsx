"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Download, Save } from "lucide-react";

type UnreceivedStudent = { id: string; rollNo: string; studentNo: string; name: string };
type Submission = {
  id: string;
  status: string;
  submittedAt: string;
  isLate: boolean;
  feedback: string;
  student: { id: string; rollNo: string; studentNo: string; name: string };
  files: { id: string; fileName: string; contentType: string; sizeBytes: number }[];
};
type GradeColumnOption = {
  id: string;
  title: string;
  period: "MIDTERM" | "AFTER_MIDTERM";
  maxScore: number;
  teachingAssignmentId: string | null;
  assignmentId: string | null;
};

export function AssignmentSubmissionReview({ assignmentId }: { assignmentId: string }) {
  const [title, setTitle] = useState("");
  const [gradebook, setGradebook] = useState<GradeColumnOption | null>(null);
  const [gradeColumns, setGradeColumns] = useState<GradeColumnOption[]>([]);
  const [selectedGradeColumnId, setSelectedGradeColumnId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [unreceived, setUnreceived] = useState<UnreceivedStudent[]>([]);
  const [mode, setMode] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { feedback: string }>>({});
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

      const currentColumn = data.assignment.gradeColumn || null;
      setTitle(data.assignment.title);
      setMode(data.assignment.mode);
      setGradebook(currentColumn);
      setUnreceived(data.unreceivedStudents || []);
      setSubmissions(data.submissions);
      setDrafts(Object.fromEntries(data.submissions.map((item: Submission) => [item.id, {
        feedback: item.feedback || "",
      }])));

      const gradebookResponse = await fetch(
        "/api/gradebook?classId=" + encodeURIComponent(data.assignment.classId),
        { cache: "no-store" },
      );
      const gradebookData = await gradebookResponse.json();
      if (!gradebookResponse.ok) throw new Error(gradebookData.error || "โหลดช่องคะแนนไม่สำเร็จ");
      const available = (gradebookData.columns || []).filter((column: GradeColumnOption) =>
        column.teachingAssignmentId === data.assignment.teachingAssignmentId &&
        (!column.assignmentId || column.assignmentId === assignmentId)
      );
      setGradeColumns(available);
      setSelectedGradeColumnId(currentColumn?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [assignmentId]);

  async function save(item: Submission, status: "REVIEWED" | "RETURNED" = "REVIEWED") {
    const draft = drafts[item.id];
    if (!draft) return;
    if (status === "RETURNED" && !draft.feedback.trim()) {
      setError("กรุณาระบุเหตุผลหรือคำแนะนำก่อนส่งงานกลับให้นักเรียน");
      return;
    }
    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/assignments/" + assignmentId + "/submissions/" + item.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, feedback: draft.feedback }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกสถานะงานไม่สำเร็จ");
      setNotice(status === "RETURNED"
        ? "ส่งงานกลับให้นักเรียน " + item.student.name + " แก้ไขแล้ว"
        : "บันทึกสถานะตรวจงานของ " + item.student.name + " แล้ว โดยไม่เปลี่ยนคะแนนในสมุดออนไลน์");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingId("");
    }
  }

  async function linkToGradebook() {
    if (!selectedGradeColumnId) {
      setError("กรุณาเลือกช่องคะแนนจากสมุดออนไลน์");
      return;
    }
    setSavingId("gradebook");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/assignments/" + assignmentId + "/gradebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeColumnId: selectedGradeColumnId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เชื่อมสมุดออนไลน์ไม่สำเร็จ");
      setNotice("เชื่อมกับช่องคะแนนเดิมแล้ว คะแนนที่มีอยู่ไม่ได้ถูกแก้ไข");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เชื่อมสมุดออนไลน์ไม่สำเร็จ");
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
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71816c]">SUBMISSION TRACKING</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">ติดตามและตรวจสถานะงาน</h1>
          <p className="mt-2 text-sm text-[#687565]">{title || "กำลังโหลดงาน..."}</p>
        </header>
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

        {!loading && (
          <section className="rounded-xl border border-[#e6e8df] bg-white p-4">
            <h2 className="text-sm font-bold">เชื่อมกับสมุดออนไลน์</h2>
            <p className="mt-1 text-xs text-[#687565]">
              {gradebook
                ? "เชื่อมอยู่กับ “" + gradebook.title + "” · เต็ม " + gradebook.maxScore + " คะแนน · ระบบจะไม่แก้ไขคะแนนที่บันทึกไว้"
                : "เลือกช่องคะแนนเดิมของรายวิชานี้ เพื่อให้ชื่องานบนหน้านักเรียนตรงกับสมุดออนไลน์"}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedGradeColumnId}
                onChange={(event) => setSelectedGradeColumnId(event.target.value)}
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#dfe4d8] bg-white px-3 text-sm"
              >
                <option value="">เลือกช่องคะแนนเดิม</option>
                {gradeColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title} · เต็ม {column.maxScore} · {column.period === "MIDTERM" ? "ก่อนกลางภาค" : "หลังกลางภาค"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={savingId === "gradebook" || !selectedGradeColumnId || selectedGradeColumnId === gradebook?.id}
                onClick={() => void linkToGradebook()}
                className="min-h-10 rounded-lg bg-[#4d5f4a] px-4 text-xs font-bold text-white disabled:opacity-50"
              >
                {savingId === "gradebook" ? "กำลังเชื่อม..." : gradebook ? "เปลี่ยนช่องคะแนน" : "เชื่อมช่องคะแนน"}
              </button>
            </div>
            {gradeColumns.length === 0 && <p className="mt-2 text-xs text-amber-800">ไม่พบช่องคะแนนที่ยังว่างในรายวิชานี้</p>}
          </section>
        )}

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
              <span className="w-fit rounded-lg bg-[#f0f3eb] px-2.5 py-1 text-xs font-semibold text-[#4d5f4a]">{item.status === "REVIEWED" ? "ตรวจแล้ว" : item.status === "RETURNED" ? "ส่งกลับแก้ไข" : "รอตรวจ"}</span>
            </div>
            {item.files.length > 0 && <div className="flex flex-wrap gap-2">{item.files.map((file) => <button key={file.id} type="button" onClick={() => openFile(file.id)} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe4d8] px-3 py-2 text-xs font-semibold text-[#4d5f4a] hover:bg-[#f8f9f6]"><Download className="h-3.5 w-3.5" />{file.fileName}</button>)}</div>}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#687565]">ความคิดเห็นครู</span><input maxLength={5000} value={drafts[item.id]?.feedback ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { feedback: event.target.value } }))} placeholder="ข้อเสนอแนะเพิ่มเติม..." className="min-h-10 w-full rounded-lg border border-[#dfe4d8] px-3 text-sm" /></label>
              <div className="flex flex-wrap gap-2"><button type="button" disabled={savingId === item.id || item.status === "REVIEWED"} onClick={() => save(item, "RETURNED")} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50">ส่งกลับให้นักเรียนแก้ไข</button><button type="button" disabled={savingId === item.id || item.status === "REVIEWED"} onClick={() => save(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#4d5f4a] px-4 text-xs font-bold text-white hover:bg-[#374535] disabled:opacity-50"><Save className="h-3.5 w-3.5" />{savingId === item.id ? "กำลังบันทึก" : "บันทึกผลตรวจ"}</button></div>
            </div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
}
