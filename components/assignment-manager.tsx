"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, BookOpen, CalendarClock, FileUp, Plus, RefreshCw } from "lucide-react";
import { compressImageBalanced } from "@/lib/client-file-compression";

type TeachingAssignment = {
  id: string;
  subject: { code: string; name: string };
  classroom: { id: string; name: string };
};
type AssignmentRow = {
  id: string;
  title: string;
  mode: "TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM";
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  classroom: { name: string };
  teachingAssignment: { subject: { code: string; name: string } };
  _count: { submissions: number };
};

export function AssignmentManager() {
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [teachingAssignmentId, setTeachingAssignmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM">("TEACHER_CHECK");
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [autoMarkAttendance, setAutoMarkAttendance] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState("");
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [courseResponse, assignmentResponse] = await Promise.all([
        fetch("/api/teaching-assignments", { cache: "no-store" }),
        fetch("/api/assignments", { cache: "no-store" }),
      ]);
      const [courses, tasks] = await Promise.all([courseResponse.json(), assignmentResponse.json()]);
      if (!courseResponse.ok) throw new Error(courses.error || "โหลดรายวิชาไม่สำเร็จ");
      if (!assignmentResponse.ok) throw new Error(tasks.error || "โหลดงานไม่สำเร็จ");
      setTeachingAssignments(courses);
      setAssignments(tasks);
      if (!teachingAssignmentId && courses.length) setTeachingAssignmentId(courses[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [teachingAssignmentId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function resolveAttendanceSession() {
    if (!autoMarkAttendance) return null;
    if (!teachingAssignmentId || !attendanceDate) throw new Error("เลือกวิชาและวันที่ของคาบเช็กชื่อก่อน");
    const params = new URLSearchParams({ teachingAssignmentId, date: attendanceDate });
    const response = await fetch("/api/attendance?" + params.toString(), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "ตรวจสอบคาบเช็กชื่อไม่สำเร็จ");
    if (!data.session?.id) throw new Error("ยังไม่มีคาบเช็กชื่อของวันที่เลือก กรุณาบันทึกการเช็กชื่อก่อน");
    return data.session.id as string;
  }

  async function uploadTeacherFiles(assignmentId: string) {
    for (const originalFile of files) {
      const file = await compressImageBalanced(originalFile);
      const presignResponse = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "assignment", parentId: assignmentId, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const presign = await presignResponse.json();
      if (!presignResponse.ok) throw new Error(presign.error || "เตรียมอัปโหลดไฟล์ครูไม่สำเร็จ");
      const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, "If-None-Match": "*" }, body: file });
      if (!uploadResponse.ok) throw new Error("อัปโหลดไฟล์ " + file.name + " ไม่สำเร็จ");
      const completeResponse = await fetch("/api/files/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "assignment", parentId: assignmentId, objectKey: presign.objectKey, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "บันทึกไฟล์แนบไม่สำเร็จ");
    }
  }

  async function createAssignment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!teachingAssignmentId) throw new Error("ยังไม่มีรายวิชาที่ผูกกับห้องเรียน");
      if (mode === "SYSTEM_UPLOAD" && files.length === 0) throw new Error("งานแบบส่งในระบบต้องแนบไฟล์คำสั่งงานอย่างน้อย 1 ไฟล์");
      const linkedSessionId = await resolveAttendanceSession();
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teachingAssignmentId,
          title,
          description,
          mode,
          status: "DRAFT",
          googleFormUrl: mode === "GOOGLE_FORM" ? googleFormUrl : "",
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          maxScore: maxScore === "" ? null : Number(maxScore),
          autoMarkAttendance,
          attendanceSessionId: linkedSessionId,
        }),
      });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || "สร้างงานไม่สำเร็จ");

      if (files.length) await uploadTeacherFiles(created.id);
      const publishResponse = await fetch("/api/assignments/" + created.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const published = await publishResponse.json();
      if (!publishResponse.ok) throw new Error(published.error || "สร้างงานแล้ว แต่เผยแพร่ไม่สำเร็จ งานยังเป็นฉบับร่าง");

      setTitle("");
      setDescription("");
      setGoogleFormUrl("");
      setDueAt("");
      setFiles([]);
      setAutoMarkAttendance(false);
      setAttendanceSessionId("");
      setNotice("เผยแพร่งานให้นักเรียนเรียบร้อยแล้ว");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const selectedCourse = teachingAssignments.find((item) => item.id === teachingAssignmentId);

  return (
    <main className="min-h-screen bg-[#f8f7f4] px-4 py-8 text-[#1c241b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71816c]">CLASSROOM WORKFLOW</p>
          <h1 className="text-3xl font-extrabold tracking-tight">มอบหมายและติดตามงาน</h1>
          <p className="text-sm text-[#687565]">สร้างงานตามรายวิชา กำหนดวิธีส่ง และติดตามรายการส่งจากนักเรียน</p>
        </header>

        <section className="rounded-2xl border border-[#e6e8df] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f3eb] text-[#4d5f4a]"><Plus className="h-5 w-5" /></div>
            <div><h2 className="font-bold">สร้างงานใหม่</h2><p className="mt-1 text-xs text-[#788174]">งานจะถูกเผยแพร่หลังบันทึกและแนบไฟล์สำเร็จ</p></div>
          </div>

          {teachingAssignments.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">ยังไม่มีรายวิชาที่ผูกกับห้องเรียน กรุณาตั้งค่าที่เมนู “รายวิชาที่สอน” ก่อน</p>
          ) : (
            <form onSubmit={createAssignment} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">รายวิชา / ห้องเรียน</span><select value={teachingAssignmentId} onChange={(event) => setTeachingAssignmentId(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#dfe4d8] bg-white px-3 text-sm">{teachingAssignments.map((item) => <option key={item.id} value={item.id}>{item.subject.code} · {item.subject.name} — {item.classroom.name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">รูปแบบการส่งงาน</span><select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); setFiles([]); }} className="min-h-11 w-full rounded-xl border border-[#dfe4d8] bg-white px-3 text-sm"><option value="TEACHER_CHECK">ตรวจกับครู — ทำในสมุดแล้วนำมาส่ง</option><option value="SYSTEM_UPLOAD">ส่งในระบบ — ดาวน์โหลดโจทย์และอัปโหลดไฟล์</option><option value="GOOGLE_FORM">Google Forms — เปิดลิงก์ทำแบบฟอร์ม</option></select></label>
              </div>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">ชื่องาน</span><input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ใบงานที่ 1 ระบบหมุนเวียนเลือด" className="min-h-11 w-full rounded-xl border border-[#dfe4d8] px-3 text-sm outline-none focus:border-[#718b6b]" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">รายละเอียด / คำชี้แจง</span><textarea maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="อธิบายสิ่งที่นักเรียนต้องทำ..." className="w-full rounded-xl border border-[#dfe4d8] px-3 py-3 text-sm outline-none focus:border-[#718b6b]" /></label>

              {mode === "GOOGLE_FORM" && <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">ลิงก์ Google Forms</span><input required type="url" value={googleFormUrl} onChange={(event) => setGoogleFormUrl(event.target.value)} placeholder="https://forms.gle/..." className="min-h-11 w-full rounded-xl border border-[#dfe4d8] px-3 text-sm outline-none focus:border-[#718b6b]" /></label>}
              {mode !== "GOOGLE_FORM" && <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">ไฟล์คำสั่งงาน / ใบงานจากครู {mode === "SYSTEM_UPLOAD" ? "(จำเป็น)" : "(ไม่บังคับ)"}</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} className="block w-full rounded-xl border border-[#dfe4d8] p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#f0f3eb] file:px-3 file:py-2 file:font-bold" />{files.length > 0 && <span className="mt-1 block text-xs text-[#788174]">เลือกแล้ว {files.length} ไฟล์</span>}</label>}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">กำหนดส่ง (ไม่บังคับ)</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#dfe4d8] px-3 text-sm" /></label>
                <label className="block"><span className="mb-2 block text-xs font-semibold text-[#687565]">คะแนนเต็ม (ไม่บังคับ)</span><input type="number" min="0" max="10000" step="0.5" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#dfe4d8] px-3 text-sm" /></label>
              </div>

              <div className="rounded-xl border border-[#e6e8df] bg-[#fafbf8] p-4">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={autoMarkAttendance} onChange={(event) => setAutoMarkAttendance(event.target.checked)} className="h-4 w-4 accent-[#4d5f4a]" /> เช็กชื่อ “มา” อัตโนมัติเมื่อส่งงาน</label>
                {autoMarkAttendance && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs text-[#687565]">วันที่ของคาบเช็กชื่อ</span><input required type="date" value={attendanceDate} onChange={async (event) => { setAttendanceDate(event.target.value); setAttendanceSessionId(""); if (event.target.value && teachingAssignmentId) { const params = new URLSearchParams({ teachingAssignmentId, date: event.target.value }); const response = await fetch("/api/attendance?" + params.toString()); const data = await response.json(); if (response.ok && data.session?.id) setAttendanceSessionId(data.session.id); } }} className="min-h-10 w-full rounded-lg border border-[#dfe4d8] px-3 text-sm" /></label><p className="self-end text-xs leading-5 text-[#687565]">{attendanceSessionId ? "พบคาบเช็กชื่อแล้ว การส่งงานจะเปลี่ยนสถานะเป็น “มา” แต่จะไม่ทับสถานะ “ลา”" : "ต้องบันทึกคาบเช็กชื่อของวันที่เลือกก่อน จึงจะเปิดใช้ตัวเลือกนี้ได้"}</p></div>}
              </div>

              {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
              <button type="submit" disabled={saving || !selectedCourse} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#4d5f4a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#374535] disabled:opacity-50"><FileUp className="h-4 w-4" />{saving ? "กำลังบันทึกและเผยแพร่..." : "บันทึกและเผยแพร่งาน"}</button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-[#e6e8df] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">งานที่สร้างไว้</h2><p className="mt-1 text-xs text-[#788174]">รายการงานในห้องเรียนที่คุณรับผิดชอบ</p></div><button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe4d8] px-3 py-2 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5" />รีเฟรช</button></div>
          {loading ? <p className="py-8 text-center text-sm text-[#788174]">กำลังโหลด...</p> : assignments.length === 0 ? <p className="py-8 text-center text-sm text-[#788174]">ยังไม่มีงานที่สร้าง</p> : <div className="divide-y divide-[#edf0e9]">{assignments.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link href={"/dashboard/assignments/" + item.id} className="truncate text-sm font-semibold text-[#4d5f4a] hover:underline">{item.title} · ตรวจงาน</Link><p className="mt-1 text-xs text-[#788174]">{item.teachingAssignment.subject.code} · {item.teachingAssignment.subject.name} — {item.classroom.name}</p></div><div className="flex items-center gap-2 text-xs"><span className="rounded-lg bg-[#f0f3eb] px-2.5 py-1 font-semibold text-[#4d5f4a]">{item.mode === "TEACHER_CHECK" ? "ตรวจกับครู" : item.mode === "SYSTEM_UPLOAD" ? "ส่งในระบบ" : "Google Forms"}</span><span className="rounded-lg border border-[#e6e8df] px-2.5 py-1">{item.status === "PUBLISHED" ? "เผยแพร่แล้ว" : item.status === "CLOSED" ? "ปิดรับแล้ว" : "ฉบับร่าง"}</span><span className="text-[#788174]">ส่งแล้ว {item._count.submissions}</span></div></div>)}</div>}
        </section>
      </div>
    </main>
  );
}
