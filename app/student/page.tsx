"use client";

import React, { useState, useEffect, useMemo } from "react";
import { compressImageBalanced } from "@/lib/client-file-compression";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ShieldCheck,
  KeyRound,
  Hash,
  School,
  FileText,
  PieChart,
  LogOut,
  Bell,
  Upload,
  ChevronRight,
  Trophy,
  Flame,
  Search,
  BookmarkCheck,
  Zap,
  CheckCircle,
  Calendar,
  ExternalLink,
  RotateCw,
  AlertCircle,
} from "lucide-react";

interface StudentProfile {
  id: string;
  dbId?: string;
  name: string;
  no: string;
  class: string;
  school: string;
  rank?: string;
  courseworkScore: string;
}

interface AssignmentItem {
  id: string;
  subject: string;
  teacher: string;
  title: string;
  dueDate: string;
  status: "pending" | "submitted";
  score?: string;
  rawScore?: number | null;
  maxScore: number | null;
  points: string;
  type: string;
  priority: "high" | "medium" | "low";
  desc: string;
  actionUrl?: string | null;
  period?: string;
  createdAt?: string;
  assignmentId?: string;
  mode?: "TEACHER_CHECK" | "SYSTEM_UPLOAD" | "GOOGLE_FORM";
  dueAt?: string | null;
  files?: { id: string; fileName: string; contentType: string; sizeBytes: number }[];
  submission?: { id: string; status: string; submittedAt: string; isLate: boolean; score: number | null; feedback: string; files: { id: string; fileName: string; contentType: string; sizeBytes: number }[] } | null;
}

interface ScoreSummaryItem {
  subject: string;
  teacher: string;
  coursework: string;
  courseworkScore: number;
  courseworkMax: number;
}

interface AnnouncementItem {
  id: number;
  title: string;
  teacher: string;
  time: string;
  detail: string;
}

export default function StudentPortalPage() {
  const [grade, setGrade] = useState("ม.5");
  const [room, setRoom] = useState("1");
  const [studentNo, setStudentNo] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [loginError, setLoginError] = useState("");

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [assignmentLoadError, setAssignmentLoadError] = useState("");
  const [scores, setScores] = useState<ScoreSummaryItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(["ทั้งหมด"]);

  // Multiple class selection state
  const [classOptions, setClassOptions] = useState<
    { studentId: string; classId: string; className: string; studentName: string }[] | null
  >(null);

  // Active Tab: "assignments" | "scores" | "announcements"
  const [dashTab, setDashTab] = useState<"assignments" | "scores" | "announcements">("assignments");
  const [filterSubject, setFilterSubject] = useState("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");

  // Submission Modal state
  const [selectedTask, setSelectedTask] = useState<AssignmentItem | null>(null);
  const [submitLink, setSubmitLink] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Check existing session on load
  useEffect(() => {
    checkCurrentSession();
  }, []);

  async function checkCurrentSession() {
    setInitialChecking(true);
    try {
      const res = await fetch("/api/student/portal");
      if (res.ok) {
        const data = await res.json();
        setStudent(data.student);
        const taskResponse = await fetch("/api/student/assignments", { cache: "no-store" });
        const taskData = taskResponse.ok ? await taskResponse.json() : null;
        if (taskResponse.ok) {
          setAssignmentLoadError("");
        } else {
          const failure = await taskResponse.json().catch(() => null);
          setAssignmentLoadError(failure?.error || "ไม่สามารถโหลดรายการงานได้ กรุณาลองใหม่ภายหลัง");
        }
        const managedTasks: AssignmentItem[] = (taskData?.assignments || []).map((task: any) => {
          const submitted = Boolean(task.submission);
          const maxScore = typeof task.maxScore === "number" ? task.maxScore : null;
          const score = task.submission?.score;
          const subject = task.subject?.code ? task.subject.code + " · " + task.subject.name : task.subject?.name || "วิชาทั่วไป";
          const type = task.mode === "TEACHER_CHECK" ? "ตรวจงานกับครู" : task.mode === "SYSTEM_UPLOAD" ? "ส่งในระบบ" : "Google Forms";
          return {
            id: "assignment:" + task.id,
            assignmentId: task.id,
            mode: task.mode,
            subject,
            teacher: task.teacher,
            title: task.title,
            dueDate: task.dueAt ? new Date(task.dueAt).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "ไม่กำหนด",
            dueAt: task.dueAt,
            status: submitted ? "submitted" : "pending",
            score: !submitted ? undefined : task.submission.status === "RETURNED" ? "ส่งกลับแก้ไข" : task.submission.status === "REVIEWED" ? (score === null ? "ตรวจแล้ว" : maxScore === null ? String(score) + " คะแนน" : String(score) + "/" + String(maxScore)) : "รอตรวจ",
            rawScore: score ?? null,
            maxScore,
            points: maxScore !== null ? String(maxScore) + " คะแนน" : "งานที่มอบหมาย",
            type,
            priority: submitted ? "low" : "high",
            desc: task.description || "ไม่มีรายละเอียดเพิ่มเติม",
            actionUrl: task.googleFormUrl,
            createdAt: task.submission?.submittedAt || "",
            files: task.files || [],
            submission: task.submission || null,
          } as AssignmentItem;
        });
        setAssignments([...(data.assignments || []), ...managedTasks]);
        setScores(data.scores || []);
        setAnnouncements(data.announcements || []);
        if (data.subjects && Array.isArray(data.subjects)) {
          setAvailableSubjects(data.subjects);
        }
      } else {
        setStudent(null);
      }
    } catch {
      setStudent(null);
    } finally {
      setInitialChecking(false);
    }
  }

  async function handleSignIn(e: React.FormEvent, selectedClassId?: string) {
    e.preventDefault();
    if (!studentNo || !studentId) return;

    setLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/student/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          room,
          studentNo: studentNo.trim(),
          studentId: studentId.trim(),
          classId: selectedClassId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
        setLoading(false);
        return;
      }

      if (data.requiresClassSelection) {
        setClassOptions(data.classes);
        setLoading(false);
        return;
      }

      setClassOptions(null);
      // Fetch fresh portal data
      await checkCurrentSession();
    } catch {
      setLoginError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/student/auth", { method: "DELETE" });
    setStudent(null);
    setStudentNo("");
    setStudentId("");
  }

  const pendingCount = useMemo(
    () => assignments.filter((item) => item.status === "pending").length,
    [assignments]
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      const matchSubject = filterSubject === "ทั้งหมด" || item.subject === filterSubject;
      const matchSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSubject && matchSearch;
    });
  }, [assignments, filterSubject, searchQuery]);

  if (initialChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FEF5ED] p-4 text-[#242e24]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ADC2A9] border-t-transparent" />
        <p className="mt-4 text-xs font-bold text-[#5e6e5e]">กำลังเชื่อมต่อระบบข้อมูลนักเรียน...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEF5ED] text-[#242e24] font-sans selection:bg-[#D3E4CD] selection:text-[#242e24] flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background ambient mesh glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#D3E4CD]/50 via-[#ADC2A9]/20 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-gradient-to-tr from-[#ADC2A9]/30 via-[#D3E4CD]/20 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-3.5 group cursor-pointer">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -3 }}
            className="h-11 w-11 rounded-2xl bg-white border border-[#ADC2A9]/40 shadow-[0_4px_20px_-4px_rgba(153,167,153,0.3)] flex items-center justify-center text-[#99A799]"
          >
            <GraduationCap className="h-6 w-6 text-[#5e6e5e]" />
          </motion.div>
          <div>
            <span className="block text-base font-black tracking-tight text-[#242e24]">งานของครู</span>
            <span className="block text-[10px] font-extrabold text-[#99A799] uppercase tracking-widest">
              ngankhongkhru.com
            </span>
          </div>
        </div>

        {student && (
          <div className="flex items-center gap-2">
            <button
              onClick={checkCurrentSession}
              title="รีเฟรชข้อมูลล่าสุด"
              className="p-2 rounded-2xl border border-[#ADC2A9]/40 bg-white/80 text-[#5e6e5e] hover:bg-white transition cursor-pointer"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#ADC2A9]/40 bg-white/80 backdrop-blur-md text-xs font-bold text-[#5e6e5e] hover:text-[#242e24] hover:bg-white hover:border-[#99A799] transition shadow-sm cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" /> ออกจากระบบ
            </motion.button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 my-auto py-4">
        <AnimatePresence mode="wait">
          {!student ? (
            /* 1. STUDENT LOGIN FORM - ULTRA HIGH-END MINIMAL */
            <motion.div
              key="student-login-form"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md w-full mx-auto"
            >
              <div className="bg-white/85 backdrop-blur-2xl border border-white/90 rounded-[3rem] p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(153,167,153,0.25)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-[#D3E4CD]/60 to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="flex justify-center mb-6">
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black bg-[#D3E4CD]/70 text-[#242e24] border border-[#ADC2A9]/40 shadow-sm backdrop-blur-sm">
                    <Sparkles className="h-3.5 w-3.5 text-[#5e6e5e]" /> ระบบเช็กงานและผลคะแนนสอบนักเรียน
                  </span>
                </div>

                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#242e24] tracking-tight">
                    เข้าสู่ระบบนักเรียน
                  </h1>
                  <p className="text-xs text-[#5e6e5e] font-medium leading-relaxed">
                    ตรวจสอบการบ้าน งานค้าง และสรุปผลคะแนนสอบของคุณ
                  </p>
                </div>

                {loginError && (
                  <div className="mb-5 flex items-center gap-2 rounded-2xl bg-rose-50 p-3.5 text-xs font-bold text-rose-700 border border-rose-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                {classOptions ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-900 border border-amber-200 space-y-1">
                      <p className="font-extrabold">พบรหัสนักเรียนในหลายห้องเรียน</p>
                      <p>กรุณาเลือกห้องเรียนของคุณเพื่อเปิดดูข้อมูล:</p>
                    </div>
                    <div className="space-y-2">
                      {classOptions.map((opt) => (
                        <button
                          key={opt.classId}
                          onClick={(e) => handleSignIn(e, opt.classId)}
                          className="flex w-full items-center justify-between rounded-2xl border border-[#ADC2A9]/40 bg-[#FEF5ED]/60 p-4 text-left transition hover:bg-white hover:border-[#99A799]"
                        >
                          <div>
                            <div className="font-black text-sm text-[#242e24]">{opt.className}</div>
                            <div className="text-xs text-[#5e6e5e]">{opt.studentName}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-[#5e6e5e]" />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setClassOptions(null)}
                      className="w-full text-center text-xs text-[#5e6e5e] underline pt-2"
                    >
                      ย้อนกลับ
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSignIn} className="space-y-5">
                    {/* Class & Room Selectors */}
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-[#242e24] flex items-center gap-1.5">
                        <School className="h-3.5 w-3.5 text-[#99A799]" /> ชั้นเรียน / ห้อง
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full appearance-none bg-[#FEF5ED]/90 border border-[#ADC2A9]/40 rounded-2xl px-4 py-3.5 text-xs font-bold text-[#242e24] focus:outline-none focus:border-[#99A799] focus:bg-white transition cursor-pointer shadow-inner"
                          >
                            <option value="ม.1">มัธยมศึกษาปีที่ 1</option>
                            <option value="ม.2">มัธยมศึกษาปีที่ 2</option>
                            <option value="ม.3">มัธยมศึกษาปีที่ 3</option>
                            <option value="ม.4">มัธยมศึกษาปีที่ 4</option>
                            <option value="ม.5">มัธยมศึกษาปีที่ 5</option>
                            <option value="ม.6">มัธยมศึกษาปีที่ 6</option>
                          </select>
                          <ChevronDown className="h-4 w-4 text-[#99A799] absolute right-3.5 top-3.5 pointer-events-none" />
                        </div>

                        <div className="relative">
                          <select
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            className="w-full appearance-none bg-[#FEF5ED]/90 border border-[#ADC2A9]/40 rounded-2xl px-4 py-3.5 text-xs font-bold text-[#242e24] focus:outline-none focus:border-[#99A799] focus:bg-white transition cursor-pointer shadow-inner"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => (
                              <option key={r} value={r}>
                                ห้อง {r}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="h-4 w-4 text-[#99A799] absolute right-3.5 top-3.5 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Student Number (เลขที่) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-[#242e24] flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-[#99A799]" /> เลขที่
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น 12"
                        value={studentNo}
                        onChange={(e) => setStudentNo(e.target.value)}
                        required
                        className="w-full bg-[#FEF5ED]/90 border border-[#ADC2A9]/40 rounded-2xl px-4 py-3.5 text-xs text-[#242e24] placeholder-[#99A799]/70 font-semibold focus:outline-none focus:border-[#99A799] focus:bg-white transition shadow-inner"
                      />
                    </div>

                    {/* Student ID / PIN Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-[#242e24] flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 text-[#99A799]" /> รหัสประจำตัวนักเรียน
                      </label>
                      <input
                        type="text"
                        placeholder="กรอกรหัสประจำตัวนักเรียน (เช่น 12345 หรือ M401001)"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        required
                        className="w-full bg-[#FEF5ED]/90 border border-[#ADC2A9]/40 rounded-2xl px-4 py-3.5 text-xs text-[#242e24] placeholder-[#99A799]/70 font-semibold focus:outline-none focus:border-[#99A799] focus:bg-white transition tracking-wider shadow-inner"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-3">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D3E4CD] via-[#ADC2A9] to-[#99A799] text-[#242e24] font-black text-xs hover:shadow-lg hover:shadow-[#ADC2A9]/30 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="h-4 w-4 border-2 border-[#242e24] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            เข้าสู่ระบบดูงานและคะแนน <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </form>
                )}

                <div className="mt-8 pt-6 border-t border-[#e5ece2] flex items-center justify-center gap-2 text-[11px] font-bold text-[#99A799]">
                  <ShieldCheck className="h-4 w-4 text-[#ADC2A9]" />
                  <span>ระบบเชื่อมต่อผลคะแนนตรงจากคุณครูประจำวิชา</span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* 2. LOGGED IN STUDENT DASHBOARD (ULTRA MODERN SUITE) */
            <motion.div
              key="student-dashboard"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4 }}
              className="max-w-4xl w-full mx-auto space-y-6"
            >
              {/* Profile Card Showcase */}
              <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] p-6 sm:p-8 border border-white shadow-[0_20px_50px_-15px_rgba(153,167,153,0.2)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#D3E4CD]/40 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center gap-5 relative z-10">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-[#D3E4CD] to-[#ADC2A9] text-[#242e24] font-black flex items-center justify-center text-xl shadow-md border-2 border-white">
                      {student.no ? student.no : "№"}
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white font-black">
                      ✓
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-[#242e24] tracking-tight">
                        {student.name}
                      </h2>
                      <span className="text-[10px] font-black bg-[#D3E4CD]/80 text-[#242e24] px-3 py-1 rounded-full border border-[#ADC2A9]/40 shadow-sm">
                        ชั้น {student.class}
                      </span>
                    </div>
                    <p className="text-xs text-[#5e6e5e] font-medium">
                      รหัสประจำตัว: {student.id} • เลขที่ {student.no} • {student.school}
                    </p>
                  </div>
                </div>

                {/* Performance Stat Pills */}
                <div className="flex items-center gap-3 shrink-0 relative z-10">
                  <div
                    onClick={() => setDashTab("assignments")}
                    className={`cursor-pointer px-4 py-3 rounded-2xl border text-center min-w-[100px] shadow-sm transition ${
                      pendingCount > 0
                        ? "bg-amber-50/90 border-amber-300 ring-2 ring-amber-200"
                        : "bg-[#FEF5ED]/90 border-[#ADC2A9]/30"
                    }`}
                  >
                    <div className="text-[10px] text-[#5e6e5e] font-bold flex items-center justify-center gap-1">
                      <Flame className="h-3 w-3 text-amber-500" /> งานค้าง
                    </div>
                    <div className="text-xl font-black text-amber-700 mt-0.5">
                      {pendingCount} งาน
                    </div>
                  </div>

                  <div
                    onClick={() => setDashTab("scores")}
                    className="cursor-pointer bg-[#FEF5ED]/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-[#ADC2A9]/30 text-center min-w-[100px] shadow-sm hover:border-[#99A799] transition"
                  >
                    <div className="text-[10px] text-[#5e6e5e] font-bold flex items-center justify-center gap-1">
                      <Trophy className="h-3 w-3 text-emerald-600" /> คะแนนเก็บรวม
                    </div>
                    <div className="text-xl font-black text-emerald-800 mt-0.5">{student.courseworkScore}</div>
                  </div>
                </div>
              </div>

              {/* Navigation Pill Bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex bg-white/80 backdrop-blur-xl p-1.5 rounded-2xl border border-[#ADC2A9]/40 shadow-sm w-full sm:w-auto">
                  <button
                    onClick={() => setDashTab("assignments")}
                    className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-black transition duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                      dashTab === "assignments"
                        ? "bg-[#D3E4CD] text-[#242e24] shadow-sm"
                        : "text-[#5e6e5e] hover:text-[#242e24]"
                    }`}
                  >
                    <FileText className="h-4 w-4" /> งานค้าง / การบ้าน ({pendingCount})
                  </button>

                  <button
                    onClick={() => setDashTab("scores")}
                    className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-black transition duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                      dashTab === "scores"
                        ? "bg-[#99A799] text-white shadow-sm"
                        : "text-[#5e6e5e] hover:text-[#242e24]"
                    }`}
                  >
                    <PieChart className="h-4 w-4" /> สรุปคะแนนสอบ
                  </button>

                  <button
                    onClick={() => setDashTab("announcements")}
                    className={`flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-black transition duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                      dashTab === "announcements"
                        ? "bg-[#242e24] text-white shadow-sm"
                        : "text-[#5e6e5e] hover:text-[#242e24]"
                    }`}
                  >
                    <Bell className="h-4 w-4" /> ประกาศ ({announcements.length})
                  </button>
                </div>

                {/* Search Bar for Assignments */}
                {dashTab === "assignments" && (
                  <div className="relative flex-1 sm:w-48 w-full">
                    <Search className="h-3.5 w-3.5 text-[#99A799] absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="ค้นหางาน หรือวิชา..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/90 border border-[#ADC2A9]/40 rounded-xl pl-8 pr-3 py-2 text-xs text-[#242e24] focus:outline-none focus:border-[#99A799]"
                    />
                  </div>
                )}
              </div>

              {/* TAB 1: ASSIGNMENTS & HOMEWORK VIEW */}
              {dashTab === "assignments" && (
                <div className="space-y-4">
                  {/* Subject Pills Filter */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {availableSubjects.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setFilterSubject(sub)}
                        className={`px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                          filterSubject === sub
                            ? "bg-[#242e24] text-white shadow-sm"
                            : "bg-white/70 text-[#5e6e5e] hover:bg-white border border-[#ADC2A9]/30"
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>

                  {assignmentLoadError && (
                    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                      {assignmentLoadError}
                    </div>
                  )}
                  <div className="space-y-3">
                    {filteredAssignments.map((item) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ y: -2 }}
                        className={`bg-white/90 backdrop-blur-xl rounded-3xl p-5 border transition-all duration-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          item.status === "pending"
                            ? "border-amber-200/80 bg-gradient-to-r from-white via-amber-50/20 to-transparent"
                            : "border-[#e5ece2]"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-[#FEF5ED] text-[#5e6e5e] border border-[#ADC2A9]/30">
                              {item.subject}
                            </span>
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-[#D3E4CD]/60 text-[#242e24]">
                              {item.type}
                            </span>
                            <span className="text-[10px] font-bold text-[#99A799]">
                              • {item.points}
                            </span>
                            {item.priority === "high" && item.status === "pending" && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-700 flex items-center gap-1">
                                <Zap className="h-2.5 w-2.5" /> ด่วนที่สุด
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-black text-[#242e24] tracking-tight">
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#5e6e5e] line-clamp-1">{item.desc}</p>

                          <div className="flex items-center gap-3 text-xs text-[#5e6e5e] pt-1">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Calendar className="h-3.5 w-3.5 text-[#99A799]" /> กำหนดส่ง: {item.dueDate}
                            </span>
                            <span className="text-[11px] text-[#99A799]">โดย {item.teacher}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-0 border-[#e5ece2]">
                          {item.status === "pending" ? (
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-200">
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span> ยังไม่ได้ส่ง
                              </span>

                              {item.actionUrl ? (
                                <a
                                  href={item.actionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-5 py-2 rounded-xl bg-[#242e24] text-white text-xs font-bold hover:bg-[#5e6e5e] transition cursor-pointer shadow-md flex items-center gap-1.5"
                                >
                                  ทำแบบฝึกหัด <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setSelectedTask(item)}
                                  className="px-5 py-2 rounded-xl bg-[#242e24] text-white text-xs font-bold hover:bg-[#5e6e5e] transition cursor-pointer shadow-md flex items-center gap-1.5"
                                >
                                  ส่งงาน <ChevronRight className="h-3.5 w-3.5" />
                                </motion.button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3.5 py-1.5 rounded-xl border border-emerald-200">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> ส่งแล้ว ({item.score})
                              </span>
                              {item.actionUrl && (
                                <a
                                  href={item.actionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl border border-[#ADC2A9]/40 bg-white text-xs text-[#5e6e5e] hover:bg-[#FEF5ED] transition"
                                  title="เปิดดูแบบฟอร์ม"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {filteredAssignments.length === 0 && (
                      <div className="text-center py-12 bg-white/60 rounded-3xl border border-dashed border-[#ADC2A9]/40">
                        <BookmarkCheck className="h-8 w-8 text-[#99A799] mx-auto mb-2" />
                        <p className="text-xs font-bold text-[#5e6e5e]">
                          {pendingCount === 0
                            ? "🎉 ยอดเยี่ยมมาก! ส่งงานครบทุกชิ้นแล้ว"
                            : "ไม่พบรายการงานค้างในวิชาที่เลือก"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: EXAM SCORES VIEW */}
              {dashTab === "scores" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-extrabold text-[#242e24]">
                      สรุปคะแนนเก็บและผลการเรียน
                    </h3>
                    <span className="text-xs text-[#5e6e5e]">อัปเดตจากสมุดคะแนน</span>
                  </div>



                  <div className="bg-white/90 backdrop-blur-2xl rounded-3xl border border-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FEF5ED] text-[#242e24] font-black border-b border-[#ADC2A9]/30">
                          <tr>
                            <th className="p-4">รายวิชา / ครูผู้สอน</th>
                            <th className="p-4 text-center">คะแนนเก็บ (ก่อน + หลังกลางภาค)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5ece2]">
                          {scores.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="p-8 text-center text-[#5e6e5e] text-xs">
                                ยังไม่มีข้อมูลคะแนนที่บันทึกในระบบ
                              </td>
                            </tr>
                          ) : (
                            scores.map((score, idx) => (
                              <tr key={idx} className="hover:bg-[#FEF5ED]/40 transition">
                                <td className="p-4 space-y-1">
                                  <div className="font-black text-[#242e24] text-sm">{score.subject}</div>
                                  <div className="text-[11px] text-[#5e6e5e] font-medium">{score.teacher}</div>
                                </td>
                                <td className="p-4 text-center font-bold text-[#242e24]">{score.coursework}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ANNOUNCEMENTS VIEW */}
              {dashTab === "announcements" && (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-[#e5ece2] shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#242e24] flex items-center gap-2">
                          <Bell className="h-4 w-4 text-[#99A799]" /> {ann.title}
                        </span>
                        <span className="text-[10px] text-[#99A799]">{ann.time}</span>
                      </div>
                      <p className="text-xs text-[#5e6e5e] leading-relaxed">{ann.detail}</p>
                      <div className="text-[11px] text-[#99A799] font-medium pt-1">โดย {ann.teacher}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Submission Modal Sheet */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full border border-white shadow-2xl space-y-5 relative overflow-hidden"
            >
              <div className="flex items-start justify-between border-b border-[#e5ece2] pb-4">
                <div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#D3E4CD] text-[#242e24]">
                    {selectedTask.subject}
                  </span>
                  <h3 className="text-base font-black text-[#242e24] mt-1">{selectedTask.title}</h3>
                  <p className="text-xs text-[#5e6e5e]">กำหนดส่ง: {selectedTask.dueDate}</p>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1 rounded-full bg-[#FEF5ED] text-[#5e6e5e] hover:bg-[#D3E4CD] transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#5e6e5e] bg-[#FEF5ED] p-3.5 rounded-2xl border border-[#ADC2A9]/30">
                  {selectedTask.desc}
                </p>

                {selectedTask.mode === "GOOGLE_FORM" && selectedTask.actionUrl ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-2">
                    <p className="text-xs font-bold text-blue-900">งานนี้ทำผ่าน Google Forms</p>
                    <a href={selectedTask.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">เปิด Google Forms <ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                ) : selectedTask.mode === "TEACHER_CHECK" ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900">{selectedTask.submission?.status === "RETURNED" ? "ครูส่งงานกลับให้แก้ไข กรุณาปรับปรุงงานแล้วนำมาส่งครูอีกครั้ง" : selectedTask.submission?.status === "REVIEWED" ? "ครูตรวจงานนี้แล้ว" : "งานนี้ให้ทำลงสมุดหรือกระดาษ แล้วนำไปส่งให้ครูตรวจในชั้นเรียน ไม่ต้องอัปโหลดไฟล์ในระบบ"}{selectedTask.submission?.feedback && <p className="mt-2 font-semibold">ความคิดเห็นครู: {selectedTask.submission.feedback}</p>}{selectedTask.submission?.submittedAt && <p className="mt-1">บันทึกการส่งล่าสุด: {new Date(selectedTask.submission.submittedAt).toLocaleString("th-TH")}</p>}</div>
                    {!!selectedTask.files?.length && <div className="rounded-2xl border border-[#ADC2A9]/30 bg-[#FEF5ED]/70 p-4"><p className="mb-2 text-xs font-bold text-[#242e24]">ไฟล์คำสั่งงานจากครู</p>{selectedTask.files.map((file) => <button key={file.id} type="button" onClick={async () => { const response = await fetch("/api/files/download?kind=assignment&fileId=" + encodeURIComponent(file.id)); const result = await response.json(); if (response.ok && result.url) window.open(result.url, "_blank", "noopener,noreferrer"); else setUploadError(result.error || "เปิดไฟล์ไม่สำเร็จ"); }} className="flex w-full items-center justify-between gap-3 py-1 text-left text-xs font-semibold text-[#4d5f4a] hover:underline"><span className="truncate">{file.fileName}</span><span className="shrink-0">ดาวน์โหลด</span></button>)}</div>}
                  </div>
                ) : selectedTask.mode === "SYSTEM_UPLOAD" ? (
                  <div className="space-y-3">
                    {!!selectedTask.files?.length && <div className="rounded-2xl border border-[#ADC2A9]/30 bg-[#FEF5ED]/70 p-4"><p className="mb-2 text-xs font-bold text-[#242e24]">ไฟล์จากครู</p>{selectedTask.files.map((file) => <button key={file.id} type="button" onClick={async () => { const response = await fetch("/api/files/download?kind=assignment&fileId=" + encodeURIComponent(file.id)); const result = await response.json(); if (response.ok && result.url) window.open(result.url, "_blank", "noopener,noreferrer"); else setUploadError(result.error || "เปิดไฟล์ไม่สำเร็จ"); }} className="flex w-full items-center justify-between gap-3 py-1 text-left text-xs font-semibold text-[#4d5f4a] hover:underline"><span className="truncate">{file.fileName}</span><span className="shrink-0">ดาวน์โหลด</span></button>)}</div>}
                    {selectedTask.submission && <div className={selectedTask.submission.status === "RETURNED" ? "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950" : "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900"}><p className="font-bold">{selectedTask.submission.status === "RETURNED" ? "ครูส่งงานกลับให้แก้ไข" : selectedTask.submission.status === "REVIEWED" ? "ครูตรวจงานแล้ว" : "ส่งงานแล้ว"}{selectedTask.submission.isLate ? " · ส่งล่าช้า" : ""}</p><p className="mt-1">เวลาส่งล่าสุด: {new Date(selectedTask.submission.submittedAt).toLocaleString("th-TH")}</p>{selectedTask.submission.feedback && <p className="mt-2">ความคิดเห็นครู: {selectedTask.submission.feedback}</p>}{!!selectedTask.submission.files.length && <p className="mt-2">ส่งแล้ว {selectedTask.submission.files.length} ไฟล์</p>}</div>}
                    {selectedTask.submission?.status !== "REVIEWED" && <div className="space-y-2"><label className="text-xs font-bold text-[#242e24] flex items-center gap-1.5"><Upload className="h-3.5 w-3.5 text-[#99A799]" /> {selectedTask.submission?.status === "RETURNED" ? "เลือกไฟล์ฉบับแก้ไข" : "เลือกไฟล์งาน (PDF, รูปภาพ, DOC/DOCX)"}</label><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} className="block w-full rounded-2xl border border-[#ADC2A9]/40 bg-[#FEF5ED]/90 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#D3E4CD] file:px-3 file:py-2 file:text-xs file:font-bold" />{selectedFiles.length > 0 && <p className="text-xs text-[#5e6e5e]">รอส่งอีก {selectedFiles.length} ไฟล์</p>}</div>}
                    {uploadError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{uploadError}</p>}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">งานนี้มาจากสมุดคะแนนเดิม โปรดดำเนินการตามวิธีที่ครูกำหนด งานจะไม่ถูกบันทึกว่าส่งแล้วจากการกดปุ่มในหน้าจอนี้</div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-5 py-2.5 rounded-xl border border-[#ADC2A9]/40 text-xs font-bold text-[#5e6e5e] hover:bg-[#FEF5ED] transition cursor-pointer"
                >
                  ปิด
                </button>
                {selectedTask.mode === "SYSTEM_UPLOAD" && selectedTask.submission?.status !== "REVIEWED" ? (
                  <button disabled={uploading || selectedFiles.length === 0} onClick={async () => {
                    if (!selectedTask.assignmentId || !selectedFiles.length) return;
                    setUploading(true);
                    setUploadError("");
                    const pendingFiles = [...selectedFiles];
                    try {
                      const alreadyUploaded = new Set((selectedTask.submission?.files || []).map((item) => item.fileName.toLocaleLowerCase()));
                      while (pendingFiles.length > 0) {
                        const originalFile = pendingFiles[0];
                        const file = await compressImageBalanced(originalFile);
                        if (alreadyUploaded.has(file.name.toLocaleLowerCase())) {
                          pendingFiles.shift();
                          setSelectedFiles([...pendingFiles]);
                          continue;
                        }
                        const presignResponse = await fetch("/api/files/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "submission", parentId: selectedTask.assignmentId, fileName: file.name, contentType: file.type, sizeBytes: file.size }) });
                        const presign = await presignResponse.json();
                        if (!presignResponse.ok) throw new Error(presign.error || "เตรียมอัปโหลดไม่สำเร็จ");
                        const safeFileName = String(presign.fileName || file.name);
                        if (alreadyUploaded.has(safeFileName.toLocaleLowerCase())) {
                          pendingFiles.shift();
                          setSelectedFiles([...pendingFiles]);
                          continue;
                        }
                        const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, "If-None-Match": "*" }, body: file });
                        if (!uploadResponse.ok) throw new Error("อัปโหลดไฟล์ " + file.name + " ไม่สำเร็จ");
                        const completeResponse = await fetch("/api/files/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "submission", parentId: selectedTask.assignmentId, objectKey: presign.objectKey, fileName: safeFileName, contentType: file.type, sizeBytes: file.size }) });
                        const complete = await completeResponse.json();
                        if (!completeResponse.ok) throw new Error(complete.error || "บันทึกไฟล์ไม่สำเร็จ");
                        const submittedAt = complete.submission.submittedAt as string;
                        alreadyUploaded.add(String(complete.file.fileName).toLocaleLowerCase());
                        setSelectedTask((current) => current ? {
                          ...current,
                          submission: {
                            id: complete.submission.id,
                            status: "SUBMITTED",
                            submittedAt,
                            isLate: Boolean(current.dueAt && new Date(submittedAt) > new Date(current.dueAt)),
                            score: null,
                            feedback: "",
                            files: [...(current.submission?.files || []), complete.file],
                          },
                        } : current);
                        pendingFiles.shift();
                        setSelectedFiles([...pendingFiles]);
                      }
                      setSelectedFiles([]);
                      await checkCurrentSession();
                    } catch (error) {
                      setSelectedFiles([...pendingFiles]);
                      setUploadError(error instanceof Error ? error.message : "ส่งงานไม่สำเร็จ");
                    } finally {
                      setUploading(false);
                    }
                  }} className="px-6 py-2.5 rounded-xl bg-[#242e24] text-white text-xs font-bold hover:bg-[#5e6e5e] transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed">{uploading ? "กำลังส่งไฟล์..." : selectedTask.submission?.status === "RETURNED" ? "ส่งงานฉบับแก้ไข" : "ยืนยันการส่งงาน"}</button>
                ) : (
                  <button onClick={() => { setSelectedTask(null); setSelectedFiles([]); setUploadError(""); }} className="px-6 py-2.5 rounded-xl bg-[#242e24] text-white text-xs font-bold hover:bg-[#5e6e5e] transition shadow-md">{selectedTask.mode === "TEACHER_CHECK" ? "รับทราบ" : "ปิด"}</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-[#99A799] space-y-1 py-4">
        <p className="font-bold text-[#242e24]">งานของครู • Student Task & Grade Suite</p>
        <p className="text-[11px]">© 2026 ngankhongkhru.com • สงวนลิขสิทธิ์</p>
      </footer>
    </div>
  );
}
