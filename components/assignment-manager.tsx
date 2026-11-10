"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  FileUp,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { compressImageBalanced } from "@/lib/client-file-compression";

type GradeColumnOption = {
  id: string;
  title: string;
  period: "BEFORE_MIDTERM" | "MIDTERM" | "AFTER_MIDTERM";
  maxScore: number;
  teachingAssignmentId: string | null;
  assignmentId: string | null;
};
type TeachingAssignment = {
  id: string;
  subject: { id: string; code: string; name: string };
  classroom: { id: string; name: string };
};
type AssignmentRow = {
  id: string;
  groupId?: string | null;
  title: string;
  mode: "TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM";
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  classroom: { name: string };
  teachingAssignment: { subject: { code: string; name: string } };
  files?: { fileName: string; contentType: string; sizeBytes: number }[];
  _count: { submissions: number };
  gradeColumn?: { id: string; title: string; period: "BEFORE_MIDTERM" | "MIDTERM" | "AFTER_MIDTERM"; maxScore: number; _count?: { scores: number } } | null;
};
type PendingAssignmentGroup = {
  groupId: string;
  mode: AssignmentRow["mode"];
  assignments: { id: string }[];
};

const fieldClass =
  "min-h-12 w-full rounded-[1.1rem] border border-[#EAE8E3] bg-[#F9F9F8] px-5 py-3 text-sm font-semibold text-[#1A1A1A] outline-none transition-all placeholder:font-medium placeholder:text-[#999999] hover:bg-white focus:border-[#166534] focus:bg-white focus:ring-2 focus:ring-[#166534]/10 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "mb-2.5 block pl-1 text-[10px] font-black uppercase tracking-widest text-[#888888]";

export function AssignmentManager() {
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [pendingGroup, setPendingGroup] = useState<PendingAssignmentGroup | null>(null);
  const [teachingAssignmentId, setTeachingAssignmentId] = useState("");
  const [targetTeachingAssignmentIds, setTargetTeachingAssignmentIds] = useState<string[]>([]);
  const [gradeColumns, setGradeColumns] = useState<GradeColumnOption[]>([]);
  const [gradeColumnId, setGradeColumnId] = useState("");
  const [gradeColumnsLoading, setGradeColumnsLoading] = useState(false);
  const [gradeColumnsVersion, setGradeColumnsVersion] = useState(0);
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM">("TEACHER_CHECK");
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [dueAt, setDueAt] = useState("");
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
      if (!teachingAssignmentId && courses.length) {
        setTeachingAssignmentId(courses[0].id);
        setTargetTeachingAssignmentIds([courses[0].id]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [teachingAssignmentId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const course = teachingAssignments.find((item) => item.id === teachingAssignmentId);
    if (!course) {
      setGradeColumns([]);
      setGradeColumnId("");
      return;
    }

    let active = true;
    setGradeColumnsLoading(true);
    setGradeColumnId("");
    fetch("/api/gradebook?classId=" + encodeURIComponent(course.classroom.id), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดช่องคะแนนไม่สำเร็จ");
        if (!active) return;
        const available = (data.columns || []).filter((column: GradeColumnOption) =>
          (column.teachingAssignmentId === teachingAssignmentId || column.teachingAssignmentId === null) && !column.assignmentId
        );
        setGradeColumns(available);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "โหลดช่องคะแนนไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setGradeColumnsLoading(false);
      });

    return () => { active = false; };
  }, [teachingAssignmentId, teachingAssignments, gradeColumnsVersion]);

  const selectedGradeColumn = gradeColumns.find((column) => column.id === gradeColumnId);
  const selectedCourse = teachingAssignments.find((item) => item.id === teachingAssignmentId);

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

  async function uploadTeacherFiles(
    assignmentId: string,
    existingFiles: { fileName: string; contentType: string; sizeBytes: number }[] = [],
  ) {
    const uploaded = new Set(existingFiles.map((file) => [file.fileName, file.contentType, file.sizeBytes].join(":")));
    for (const originalFile of files) {
      const file = await compressImageBalanced(originalFile);
      const signature = [file.name, file.type, file.size].join(":");
      if (uploaded.has(signature)) continue;

      const presignResponse = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "assignment", parentId: assignmentId, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const presign = await presignResponse.json();
      if (!presignResponse.ok) throw new Error(presign.error || "เตรียมอัปโหลดไฟล์ครูไม่สำเร็จ");
      const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("อัปโหลดไฟล์ " + file.name + " ไม่สำเร็จ");
      const completeResponse = await fetch("/api/files/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "assignment", parentId: assignmentId, objectKey: presign.objectKey, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "บันทึกไฟล์แนบไม่สำเร็จ");
      uploaded.add(signature);
    }
  }

  async function createAssignment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    let recoveryGroup = pendingGroup;
    try {
      if (!recoveryGroup) {
        if (!teachingAssignmentId) throw new Error("ยังไม่มีรายวิชาที่ผูกกับห้องเรียน");
        if (!gradeColumnId || !selectedGradeColumn) throw new Error("กรุณาเลือกชื่องานจากสมุดออนไลน์ก่อน");
        if (mode === "SYSTEM_UPLOAD" && files.length === 0) throw new Error("งานแบบส่งในระบบต้องแนบไฟล์คำสั่งงานอย่างน้อย 1 ไฟล์");

        const targetIds = Array.from(new Set([teachingAssignmentId, ...targetTeachingAssignmentIds]));
        const linkedSessionId = await resolveAttendanceSession();
        const response = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teachingAssignmentId,
            targetTeachingAssignmentIds: targetIds,
            gradeColumnId,
            description,
            mode,
            status: "DRAFT",
            googleFormUrl: mode === "GOOGLE_FORM" ? googleFormUrl : "",
            dueAt: dueAt ? new Date(dueAt).toISOString() : null,
            autoMarkAttendance,
            attendanceSessionId: linkedSessionId,
            attendanceDate: autoMarkAttendance ? attendanceDate : "",
          }),
        });
        const created = await response.json();
        if (!response.ok) throw new Error(created.error || "สร้างงานไม่สำเร็จ");
        if (!created.groupId || !Array.isArray(created.assignments) || created.assignments.length !== targetIds.length) {
          throw new Error("ระบบสร้างกลุ่มงานไม่สมบูรณ์ กรุณารีเฟรชก่อนลองใหม่");
        }
        recoveryGroup = {
          groupId: created.groupId,
          mode,
          assignments: created.assignments.map((target: { id: string }) => ({ id: target.id })),
        };
        setPendingGroup(recoveryGroup);
      }

      if (recoveryGroup.mode === "SYSTEM_UPLOAD") {
        if (files.length === 0) throw new Error("เลือกไฟล์คำสั่งงานเดิมอีกครั้งเพื่อทำรายการที่ค้างต่อ");
        const assignmentResponse = await fetch("/api/assignments", { cache: "no-store" });
        const currentAssignments = await assignmentResponse.json();
        if (!assignmentResponse.ok || !Array.isArray(currentAssignments)) {
          throw new Error("ตรวจสอบไฟล์ที่อัปโหลดไปแล้วไม่สำเร็จ กรุณาลองใหม่");
        }
        const filesByAssignment = new Map<string, { fileName: string; contentType: string; sizeBytes: number }[]>(
          currentAssignments.map((item: AssignmentRow) => [item.id, item.files || []] as const),
        );
        for (const target of recoveryGroup.assignments) {
          const existingFiles = filesByAssignment.get(target.id);
          if (!existingFiles) throw new Error("ไม่พบงานฉบับร่างที่กำลังทำต่อ กรุณารีเฟรชรายการงาน");
          await uploadTeacherFiles(target.id, existingFiles);
        }
      }

      const publishResponse = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: recoveryGroup.groupId, status: "PUBLISHED" }),
      });
      const published = await publishResponse.json();
      if (!publishResponse.ok) throw new Error(published.error || "สร้างงานแล้ว แต่เผยแพร่ทั้งชุดไม่สำเร็จ งานยังเป็นฉบับร่าง");

      setPendingGroup(null);
      setGradeColumnId("");
      setTargetTeachingAssignmentIds([teachingAssignmentId]);
      setDescription("");
      setGoogleFormUrl("");
      setDueAt("");
      setFiles([]);
      setAutoMarkAttendance(false);
      setAttendanceDate("");
      setAttendanceSessionId("");
      setNotice("เผยแพร่งานชุดเดียวให้นักเรียน " + recoveryGroup.assignments.length + " ห้องเรียนเรียบร้อยแล้ว");
      await refresh();
      setGradeColumnsVersion((current) => current + 1);
    } catch (err) {
      if (recoveryGroup) {
        setPendingGroup(recoveryGroup);
        await refresh();
      }
      setError(err instanceof Error ? err.message : "สร้างงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const modeLabel = (value: AssignmentRow["mode"]) =>
    value === "TEACHER_CHECK" ? "ตรวจกับครู" : value === "SYSTEM_UPLOAD" ? "ส่งในระบบ" : "Google Forms";
  const statusLabel = (value: AssignmentRow["status"]) =>
    value === "PUBLISHED" ? "เผยแพร่แล้ว" : value === "CLOSED" ? "ปิดรับแล้ว" : "ฉบับร่าง";
  const assignmentGroups = Array.from(
    assignments.reduce((groups, item) => {
      const key = item.groupId || item.id;
      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
      return groups;
    }, new Map<string, AssignmentRow[]>()).values(),
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F4F2] px-4 pb-20 pt-8 text-[#1A1A1A] sm:px-6 sm:pt-10 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#EAE8E3]/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-[#D1CDC4]/30 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl space-y-9">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#166534]">CLASSROOM WORKFLOW</p>
            <h1 className="text-3xl font-black tracking-tight text-[#1A1A1A] sm:text-4xl">มอบหมายและติดตามงาน</h1>
            <p className="max-w-2xl text-sm font-medium leading-6 text-[#666666]">สร้างงานตามรายวิชา กำหนดวิธีส่ง และติดตามรายการส่งจากนักเรียนอย่างเป็นระบบ</p>
          </div>
          <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#EAE8E3] bg-white px-5 py-2.5 text-xs font-bold text-[#166534] shadow-sm transition hover:border-[#86EFAC] hover:bg-[#F0FDF4] sm:self-auto">
            <ExternalLink className="h-4 w-4" /> กลับหน้าหลัก
          </Link>
        </header>

        <section className="relative rounded-[2rem] border border-white bg-white/85 p-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] backdrop-blur-2xl sm:rounded-[2.5rem] sm:p-8 lg:p-10">
          <div className="flex items-center justify-between border-b border-[#EAE8E3] pb-5 sm:pb-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#166534] to-[#14532D] text-white shadow-lg shadow-[#166534]/20 sm:h-12 sm:w-12">
                <Plus className="h-5 w-5 text-[#A7F3D0]" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight sm:text-xl">สร้างงานใหม่</h2>
                <p className="mt-1 text-xs font-medium text-[#666666]">ตั้งค่ารายละเอียดและวิธีส่งงาน</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-[#D1FAE5] bg-[#F0FDF4] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#166534] sm:inline-flex">New Assignment</span>
          </div>

          {teachingAssignments.length === 0 && !loading ? (
            <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">ยังไม่มีรายวิชาที่ผูกกับห้องเรียน กรุณาตั้งค่าที่เมนู “รายวิชาที่สอน” ก่อน</p>
          ) : (
            <form onSubmit={createAssignment} className="space-y-6 pt-6">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>รายวิชา / ห้องเรียน</span>
                  <select value={teachingAssignmentId} onChange={(event) => { setTeachingAssignmentId(event.target.value); setTargetTeachingAssignmentIds([event.target.value]); setGradeColumnId(""); }} disabled={Boolean(pendingGroup) || saving} className={fieldClass}>
                    {teachingAssignments.map((item) => <option key={item.id} value={item.id}>{item.subject.code} · {item.subject.name} — {item.classroom.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>รูปแบบการส่งงาน</span>
                  <select value={mode} onChange={(event) => { const nextMode = event.target.value as typeof mode; setMode(nextMode); setFiles([]); if (nextMode !== "SYSTEM_UPLOAD") { setAutoMarkAttendance(false); setAttendanceDate(""); setAttendanceSessionId(""); } }} disabled={Boolean(pendingGroup) || saving} className={fieldClass}>
                    <option value="TEACHER_CHECK">ตรวจกับครู — ทำในสมุดแล้วนำมาส่ง</option>
                    <option value="SYSTEM_UPLOAD">ส่งในระบบ — ดาวน์โหลดโจทย์และอัปโหลดไฟล์</option>
                    <option value="GOOGLE_FORM">Google Forms — เปิดลิงก์ทำแบบฟอร์ม</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-[#EAE8E3] bg-[#F9F9F8] p-4 sm:p-5">
                <div>
                  <span className={labelClass}>ห้องเรียนที่ได้รับมอบหมาย</span>
                  <p className="text-xs leading-5 text-[#666666]">เลือกหลายห้องในรายวิชาเดียวกันได้ งานจะแสดงเป็นรายการเดียวในหน้าครู โดยแต่ละห้องยังมีคะแนนและการส่งงานแยกกัน ห้องอื่นต้องมีช่องคะแนนที่ชื่อ ช่วงคะแนน และคะแนนเต็มตรงกับงานที่เลือก</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teachingAssignments.filter((course) => !selectedCourse || course.subject.id === selectedCourse.subject.id).map((course) => {
                    const checked = course.id === teachingAssignmentId || targetTeachingAssignmentIds.includes(course.id);
                    return (
                      <label key={course.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${checked ? "border-[#A7F3D0] bg-[#F0FDF4]" : "border-[#EAE8E3] bg-white hover:border-[#D1CDC4]"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={course.id === teachingAssignmentId || saving || Boolean(pendingGroup)}
                          onChange={(event) => setTargetTeachingAssignmentIds((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, course.id]))
                              : current.filter((id) => id !== course.id)
                          )}
                          className="mt-0.5 h-4 w-4 accent-[#166534]"
                        />
                        <span className="min-w-0 text-xs font-bold text-[#333333]">
                          <span className="block">{course.subject.code} · {course.subject.name}</span>
                          <span className="mt-1 block text-[11px] font-medium text-[#888888]">{course.classroom.name}{course.id === teachingAssignmentId ? " · ห้องหลัก" : ""}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className={labelClass}>ชื่องานจากสมุดออนไลน์</span>
                <select required={!pendingGroup} value={gradeColumnId} onChange={(event) => setGradeColumnId(event.target.value)} disabled={Boolean(pendingGroup) || gradeColumnsLoading || gradeColumns.length === 0} className={fieldClass}>
                  <option value="">{gradeColumnsLoading ? "กำลังโหลดช่องคะแนน..." : gradeColumns.length ? "เลือกงานที่มีอยู่ในสมุดออนไลน์" : "ยังไม่มีช่องคะแนนที่เชื่อมกับรายวิชานี้"}</option>
                  {gradeColumns.map((column) => <option key={column.id} value={column.id}>{column.title} · เต็ม {column.maxScore} · {column.period === "AFTER_MIDTERM" ? "หลังกลางภาค" : "ก่อนกลางภาค"}</option>)}
                </select>
                {selectedGradeColumn && <span className="mt-2 block rounded-xl bg-[#F0FDF4] px-4 py-3 text-xs font-medium leading-5 text-[#166534]"><Check className="mr-1 inline h-3.5 w-3.5" /> คะแนนเต็มและชื่องานจะอ้างอิงจากสมุดออนไลน์ โดยระบบจะจับคู่ช่องคะแนนที่ตรงกันในห้องอื่น และไม่แก้ไขคะแนนเดิม</span>}
              </label>

              <label className="block">
                <span className={labelClass}>รายละเอียด / คำชี้แจง</span>
                <textarea maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="อธิบายสิ่งที่นักเรียนต้องทำอย่างละเอียด..." className="w-full resize-y rounded-[1.25rem] border border-[#EAE8E3] bg-[#F9F9F8] px-5 py-4 text-sm font-medium leading-6 text-[#1A1A1A] outline-none transition hover:bg-white focus:border-[#166534] focus:bg-white focus:ring-2 focus:ring-[#166534]/10" />
              </label>

              {mode === "GOOGLE_FORM" && (
                <label className="block">
                  <span className={labelClass}><Link2 className="mr-1 inline h-3.5 w-3.5 text-[#166534]" /> ลิงก์ Google Forms</span>
                  <input required type="url" value={googleFormUrl} onChange={(event) => setGoogleFormUrl(event.target.value)} placeholder="https://forms.gle/..." className={fieldClass} />
                </label>
              )}

              {mode !== "GOOGLE_FORM" && (
                <div className="space-y-2.5">
                  <span className={labelClass}><FileUp className="mr-1 inline h-3.5 w-3.5 text-[#166534]" /> ไฟล์คำสั่งงาน / ใบงานจากครู {mode === "SYSTEM_UPLOAD" ? "(จำเป็น)" : "(ไม่บังคับ)"}</span>
                  <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed border-[#A7F3D0] bg-[#F9F9F8] px-5 py-8 text-center transition hover:border-[#166534]/50 hover:bg-[#F0FDF4]/40">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#EAE8E3] bg-white text-[#166534] shadow-sm transition group-hover:scale-105"><UploadCloud className="h-6 w-6" /></span>
                    <span className="text-sm font-black text-[#1A1A1A]">คลิกเพื่อเลือกไฟล์</span>
                    <span className="text-[11px] font-bold tracking-wide text-[#888888]">รองรับ PDF, JPG, PNG, WebP, DOC และ DOCX</span>
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} className="sr-only" />
                  </label>
                  {files.length > 0 && <p className="text-xs font-semibold text-[#166534]">เลือกแล้ว {files.length} ไฟล์: {files.map((file) => file.name).join(", ")}</p>}
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className={labelClass}><Calendar className="mr-1 inline h-3.5 w-3.5 text-[#166534]" /> กำหนดส่ง (วันที่และเวลา)</span>
                  <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={fieldClass} />
                </label>
                <div className="space-y-2.5">
                  <span className={labelClass}><Clock className="mr-1 inline h-3.5 w-3.5 text-[#166534]" /> การตั้งค่าคะแนน</span>
                  <div className="flex min-h-12 items-center rounded-[1.1rem] border border-[#EAE8E3] bg-[#F9F9F8] px-5 text-sm font-semibold text-[#555555]">
                    {selectedGradeColumn ? <>คะแนนเต็ม <strong className="ml-1 text-[#166534]">{selectedGradeColumn.maxScore}</strong><span className="ml-1">คะแนน · อ้างอิงสมุดออนไลน์</span></> : "เลือกชื่องานเพื่อดูคะแนนเต็ม"}
                  </div>
                </div>
              </div>

              {mode === "SYSTEM_UPLOAD" && (
                <div className="rounded-[1.5rem] border border-[#EAE8E3] bg-[#F9F9F8] p-4 sm:p-5">
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-bold text-[#333333]">
                    <input type="checkbox" checked={autoMarkAttendance} onChange={(event) => setAutoMarkAttendance(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#166534]" />
                    <span>เช็กชื่อ “มา” อัตโนมัติเมื่อนักเรียนส่งงานสำเร็จในระบบ</span>
                  </label>
                  {autoMarkAttendance && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block"><span className={labelClass}>วันที่ของคาบเช็กชื่อ</span><input required type="date" value={attendanceDate} onChange={async (event) => { setAttendanceDate(event.target.value); setAttendanceSessionId(""); if (event.target.value && teachingAssignmentId) { const params = new URLSearchParams({ teachingAssignmentId, date: event.target.value }); const response = await fetch("/api/attendance?" + params.toString()); const data = await response.json(); if (response.ok && data.session?.id) setAttendanceSessionId(data.session.id); } }} className={fieldClass} /></label>
                      <p className="self-end rounded-xl bg-white p-3 text-xs leading-5 text-[#687565]">{attendanceSessionId ? "พบคาบเช็กชื่อแล้ว ระบบจะบันทึก “มา” เฉพาะกรณีที่ยังไม่มีสถานะเดิม" : "ต้องบันทึกคาบเช็กชื่อของวันที่เลือกก่อน จึงจะเปิดใช้ตัวเลือกนี้ได้"}</p>
                    </div>
                  )}
                </div>
              )}

              {pendingGroup && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">กำลังทำงานฉบับร่างที่สร้างไว้ต่อ ระบบจะไม่สร้างงานหรือเชื่อมช่องคะแนนซ้ำ หากเป็นงานส่งไฟล์ ให้เลือกไฟล์คำสั่งงานชุดเดิมอีกครั้งเพื่อข้ามไฟล์ที่บันทึกแล้วและทำต่อ</p>}
              {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">{notice}</p>}

              <div className="border-t border-[#EAE8E3] pt-5">
                <button type="submit" disabled={saving || (!pendingGroup && (!selectedCourse || !selectedGradeColumn)) || gradeColumnsLoading} className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-[1.25rem] border border-[#A7F3D0] bg-[#E5F3EB] px-5 py-4 text-sm font-black tracking-wide text-[#166534] transition hover:border-[#86EFAC] hover:bg-[#D1FAE5] hover:shadow-[0_15px_40px_rgba(22,101,52,0.12)] disabled:cursor-not-allowed disabled:opacity-50">
                  <Sparkles className="h-4 w-4" />{saving ? "กำลังบันทึกและเผยแพร่..." : pendingGroup ? "ดำเนินการต่อและเผยแพร่" : "มอบหมายงานให้นักเรียน"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E5F3EB] text-[#166534]"><Layers className="h-5 w-5" /></div>
              <div><h2 className="text-lg font-black tracking-tight">งานที่สร้างไว้</h2><p className="mt-0.5 text-xs font-medium text-[#888888]">รายการงานในห้องเรียนที่คุณรับผิดชอบ</p></div>
            </div>
            <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-[#EAE8E3] bg-white px-4 py-2.5 text-xs font-bold text-[#166534] shadow-sm transition hover:bg-[#F0FDF4] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />รีเฟรช</button>
          </div>

          {loading ? (
            <div className="rounded-[1.5rem] border border-[#EAE8E3] bg-white/80 py-12 text-center text-sm font-semibold text-[#888888]">กำลังโหลดรายการงาน...</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[#D1CDC4] bg-white/50 py-12 text-center">
              <Layers className="mx-auto mb-3 h-8 w-8 text-[#CCCCCC]" />
              <p className="text-sm font-bold text-[#888888]">ยังไม่มีงานที่มอบหมาย</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {assignmentGroups.map((group) => {
                const item = group[0];
                const submissionCount = group.reduce((total, entry) => total + (entry.mode === "TEACHER_CHECK" ? Math.max(entry._count.submissions, entry.gradeColumn?._count?.scores ?? 0) : entry._count.submissions), 0);
                const groupStatus = group.every((entry) => entry.status === item.status)
                  ? statusLabel(item.status)
                  : "สถานะไม่ตรงกัน";
                return (
                  <article key={item.groupId || item.id} className="group rounded-[1.5rem] border border-[#EAE8E3] bg-white/90 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-[#166534]/30 hover:shadow-lg sm:p-6">
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-[#D1FAE5] bg-[#F0FDF4] px-2.5 py-1 text-[10px] font-black text-[#166534]">{item.teachingAssignment.subject.code} · {item.teachingAssignment.subject.name}</span>
                          {group.map((entry) => (
                            <span key={entry.id} className="rounded-lg border border-[#EAE8E3] bg-[#F9F9F8] px-2.5 py-1 text-[10px] font-bold text-[#666666]">{entry.classroom.name}</span>
                          ))}
                          <span className="rounded-lg bg-[#F4F4F2] px-2.5 py-1 text-[10px] font-bold text-[#666666]">{modeLabel(item.mode)}</span>
                        </div>
                        <h3 className="truncate text-base font-black text-[#1A1A1A] transition-colors group-hover:text-[#166534]">{item.gradeColumn?.title || item.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-[#888888]">
                          <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {item.gradeColumn ? `เต็ม ${item.gradeColumn.maxScore} คะแนน` : "ยังไม่เชื่อมสมุดออนไลน์"}</span>
                          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> {groupStatus}</span>
                          <span>{group.length} ห้องเรียน</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {group.map((entry) => (
                            <Link key={entry.id} href={"/dashboard/assignments/" + entry.id} className="inline-flex items-center gap-1 rounded-lg border border-[#EAE8E3] px-3 py-1.5 text-[11px] font-bold text-[#166534] transition hover:border-[#166534] hover:bg-[#F0FDF4]">
                              {entry.classroom.name} · ดู/ตรวจงาน
                            </Link>
                          ))}
                          {item.groupId && group.every((entry) => entry.status === "DRAFT") && (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingGroup({ groupId: item.groupId!, mode: item.mode, assignments: group.map((entry) => ({ id: entry.id })) });
                                setMode(item.mode);
                                setFiles([]);
                                setError("");
                                setNotice(item.mode === "SYSTEM_UPLOAD" ? "เลือกไฟล์คำสั่งงานชุดเดิมเพื่อดำเนินการต่อ" : "กดดำเนินการต่อเพื่อเผยแพร่งานชุดนี้");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100"
                            >
                              {item.mode === "SYSTEM_UPLOAD" ? "แนบไฟล์ต่อ / เผยแพร่" : "เผยแพร่งานต่อ"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
                        <div className="min-w-[6rem] text-right">
                          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#888888]">ส่งแล้วรวม</div>
                          <div className="text-lg font-black tabular-nums text-[#166534]">{submissionCount} <span className="text-xs font-bold text-[#999999]">รายการ</span></div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
