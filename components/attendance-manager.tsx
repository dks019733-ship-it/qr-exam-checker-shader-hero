"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowLeft, BookOpen, CalendarDays, Check, CheckCircle2, CheckCheck,
  ChevronLeft, ChevronRight, Clock3, Hash, Search, Save, Sparkles, Users, UserX,
} from "lucide-react";

type TeachingAssignment = {
  id: string;
  subject: { code: string; name: string };
  classroom: { id: string; name: string };
};
type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "LATE";
type StudentRow = {
  id: string;
  rollNo: string;
  studentNo: string;
  name: string;
  attendance: AttendanceStatus | null;
  note: string;
};
type AttendancePayload = {
  session: { id: string; date: string; period: number; topic: string } | null;
  classroom: { id: string; name: string };
  subject: { code: string; name: string };
  students: StudentRow[];
};
type AttendanceHistoryItem = { id: string; date: string; period: number; topic: string; total: number; present: number; absent: number; leave: number; late: number };

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  icon: typeof Check;
  selectedClass: string;
}[] = [
  { value: "PRESENT", label: "มาเรียน", icon: Check, selectedClass: "bg-gradient-to-b from-[#2C3E32] to-[#1E2B23] text-white border-[#1E2B23] shadow-lg shadow-[#2C3E32]/20" },
  { value: "LEAVE", label: "ลา", icon: AlertCircle, selectedClass: "bg-gradient-to-b from-[#96846E] to-[#7A6B58] text-white border-[#7A6B58] shadow-lg shadow-[#96846E]/20" },
  { value: "LATE", label: "สาย", icon: Clock3, selectedClass: "bg-gradient-to-b from-[#B88059] to-[#966747] text-white border-[#966747] shadow-lg shadow-[#B88059]/20" },
  { value: "ABSENT", label: "ขาด", icon: UserX, selectedClass: "bg-gradient-to-b from-[#8C3A3A] to-[#6E2D2D] text-white border-[#6E2D2D] shadow-lg shadow-[#8C3A3A]/20" },
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEK_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function localDateValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateParts(value: string) {
  const parts = value.split("-").map(Number);
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function thaiDate(value: string) {
  if (!value) return "—";
  const { year, month, day } = dateParts(value);
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dateValue(year: number, monthIndex: number, day: number) {
  return [
    year,
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function AttendanceManager() {
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState(localDateValue);
  const [period, setPeriod] = useState(1);
  const [topic, setTopic] = useState("");
  const [history, setHistory] = useState<AttendanceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [navDate, setNavDate] = useState(() => {
    const parts = dateParts(localDateValue());
    return new Date(parts.year, parts.month - 1, 1);
  });

  useEffect(() => {
    let active = true;
    fetch("/api/teaching-assignments", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("ไม่สามารถโหลดรายวิชาที่สอนได้");
        return response.json();
      })
      .then((data: TeachingAssignment[]) => {
        if (!active) return;
        setAssignments(data);
        if (data.length) setAssignmentId(data[0].id);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!assignmentId || !date) {
      setStudents([]);
      setLoading(false);
      setDirty(false);
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    setDirty(false);
    setLoadedSessionId(null);
    try {
      const params = new URLSearchParams({ teachingAssignmentId: assignmentId, date, period: String(period) });
      const response = await fetch("/api/attendance?" + params.toString(), { cache: "no-store" });
      const data = await response.json() as AttendancePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "โหลดข้อมูลเช็กชื่อไม่สำเร็จ");
      setStudents(data.students);
      setTopic(data.session?.topic || "");
      setLoadedSessionId(data.session?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setStudents([]);
      setLoadedSessionId(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, date, period]);

  const loadHistory = useCallback(async (page = 1, append = false) => {
    if (!assignmentId) { setHistory([]); setHistoryHasMore(false); return; }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ teachingAssignmentId: assignmentId, page: String(page) });
      const response = await fetch("/api/attendance/history?" + params.toString(), { cache: "no-store" });
      const data = await response.json() as { sessions?: AttendanceHistoryItem[]; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "โหลดประวัติการเช็กชื่อไม่สำเร็จ");
      const nextSessions = Array.isArray(data.sessions) ? data.sessions : [];
      setHistory((current) => append ? [...current, ...nextSessions] : nextSessions);
      setHistoryHasMore(data.hasMore === true);
    } catch (err) {
      if (!append) setHistory([]);
      setHistoryHasMore(false);
      setError(err instanceof Error ? err.message : "โหลดประวัติการเช็กชื่อไม่สำเร็จ");
    } finally { setHistoryLoading(false); }
  }, [assignmentId]);

  useEffect(() => { void loadAttendance(); }, [loadAttendance]);
  useEffect(() => { void loadHistory(1, false); }, [loadHistory]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th-TH");
    if (!query) return students;
    return students.filter((student) =>
      [student.name, student.studentNo, student.rollNo].some((value) =>
        value.toLocaleLowerCase("th-TH").includes(query),
      ),
    );
  }, [students, search]);

  const counts = useMemo(() => ({
    PRESENT: students.filter((student) => student.attendance === "PRESENT").length,
    LATE: students.filter((student) => student.attendance === "LATE").length,
    LEAVE: students.filter((student) => student.attendance === "LEAVE").length,
    ABSENT: students.filter((student) => student.attendance === "ABSENT").length,
    unmarked: students.filter((student) => !student.attendance).length,
  }), [students]);

  const selected = assignments.find((assignment) => assignment.id === assignmentId);
  const currentYear = navDate.getFullYear();
  const currentMonth = navDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const calendarCells = [
    ...Array.from({ length: firstDayOfMonth }, (_, index) => ({ key: "blank-" + index, day: 0 })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: "day-" + (index + 1), day: index + 1 })),
  ];

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStudents((current) => current.map((student) =>
      student.id === studentId ? { ...student, attendance: status } : student,
    ));
    setDirty(true);
    setNotice("");
  }

  function markAllPresent() {
    setStudents((current) => current.map((student) =>
      student.attendance === "LEAVE" ? student : { ...student, attendance: "PRESENT" },
    ));
    setDirty(true);
    setNotice("");
  }

  function openCalendar() {
    const parts = dateParts(date);
    setNavDate(new Date(parts.year, parts.month - 1, 1));
    setShowDatePicker((open) => !open);
  }

  function selectDate(value: string) {
    if (value === date) { setShowDatePicker(false); return; }
    if (dirty && !window.confirm("มีข้อมูลเช็กชื่อที่ยังไม่ได้บันทึก ต้องการเปลี่ยนวันและละทิ้งการแก้ไขนี้หรือไม่?")) return;
    setDate(value);
    setShowDatePicker(false);
  }

  function selectPeriod(value: string) {
    const nextPeriod = Number(value);
    if (!Number.isInteger(nextPeriod) || nextPeriod < 1 || nextPeriod > 8 || nextPeriod === period) return;
    if (dirty && !window.confirm("มีข้อมูลเช็กชื่อที่ยังไม่ได้บันทึก ต้องการเปลี่ยนคาบและละทิ้งการแก้ไขนี้หรือไม่?")) return;
    setPeriod(nextPeriod);
  }

  function openHistory(item: AttendanceHistoryItem) {
    if (dirty && !window.confirm("มีข้อมูลเช็กชื่อที่ยังไม่ได้บันทึก ต้องการเปิดประวัติและละทิ้งการแก้ไขนี้หรือไม่?")) return;
    setDate(item.date);
    setPeriod(item.period);
    setShowDatePicker(false);
  }

  function chooseDate(day: number) {
    selectDate(dateValue(currentYear, currentMonth, day));
  }

  async function saveAttendance() {
    if (!assignmentId || !date || saving || students.length === 0) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teachingAssignmentId: assignmentId,
          date,
          period,
          topic,
          records: students.filter((student) => student.attendance).map((student) => ({
            studentId: student.id,
            status: student.attendance,
            note: student.note,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setLoadedSessionId(data.session?.id ?? loadedSessionId);
      setDirty(false);
      setNotice((loadedSessionId ? "อัปเดตประวัติ" : "บันทึกสถานะ") + "นักเรียน " + data.savedRecords + " คนแล้ว");
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const summaryCards = [
    {
      label: "มาเรียน",
      value: counts.PRESENT,
      total: students.length,
      icon: CheckCircle2,
      tone: "text-[#2C3E32]",
      bar: "bg-[#2C3E32]",
    },
    {
      label: "ลา / สาย",
      value: counts.LEAVE + counts.LATE,
      total: students.length,
      icon: Clock3,
      tone: "text-[#B88059]",
      bar: "bg-[#B88059]",
    },
    {
      label: "ขาดเรียน",
      value: counts.ABSENT,
      total: students.length,
      icon: UserX,
      tone: "text-[#8C3A3A]",
      bar: "bg-[#8C3A3A]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F4F2] pb-36 font-sans text-[#1A1A1A] selection:bg-[#EAE8E3]">
      {showDatePicker && (
        <button
          type="button"
          aria-label="ปิดปฏิทิน"
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setShowDatePicker(false)}
        />
      )}

      <header className="relative z-30 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-3xl border border-white bg-white/75 px-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2C3E32] to-[#1E2B23] text-[#F7F7F5] shadow-md">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight">ระบบบันทึกเวลาเรียน</h1>
              <p className="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#8B7A66]">ATTENDANCE MANAGEMENT</p>
            </div>
          </div>
          <a
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#EAE8E3] bg-white px-4 py-2 text-xs font-bold text-[#4d5f4a] shadow-sm transition hover:border-[#D1CDC4] hover:bg-[#F9F9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E32] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>กลับหน้าหลัก</span>
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-7 px-4 pt-7 sm:px-6 lg:px-8">
        <section className="relative z-50 rounded-[2rem] border border-white bg-white/85 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.035)] backdrop-blur-2xl sm:rounded-[2.5rem] sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
            <Sparkles className="h-4 w-4 text-[#8B7A66]" />
            ข้อมูลคาบเรียน <span className="font-semibold text-[#9A968E]">(Class Info)</span>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <label className="block min-w-0 space-y-2">
              <span className="flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                <Hash className="h-3 w-3" /> รายวิชา / ห้องเรียน
              </span>
              <select
                value={assignmentId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  if (nextId === assignmentId) return;
                  if (dirty && !window.confirm("มีข้อมูลเช็กชื่อที่ยังไม่ได้บันทึก ต้องการเปลี่ยนรายวิชาและละทิ้งการแก้ไขนี้หรือไม่?")) return;
                  setAssignmentId(nextId);
                }}
                disabled={loading && assignments.length === 0}
                className="min-h-[50px] w-full rounded-2xl border border-[#EAE8E3] bg-[#F9F9F8] px-4 text-sm font-bold text-[#1A1A1A] shadow-inner outline-none transition focus:border-[#2C3E32] focus:bg-white focus:shadow-md disabled:opacity-60"
              >
                {assignments.length === 0 && <option value="">ยังไม่มีรายวิชาที่กำหนด</option>}
                {assignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subject.code} · {item.subject.name} — {item.classroom.name}
                  </option>
                ))}
              </select>
              <p className="pl-1 text-[11px] text-[#999999]">เลือกวิชาและห้องเรียนที่ต้องการเช็กชื่อ</p>
            </label>

            <label className="block min-w-0 space-y-2">
              <span className="flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                <BookOpen className="h-3 w-3" /> เรื่องที่สอนวันนี้
              </span>
              <input
                type="text"
                value={topic}
                onChange={(event) => { setTopic(event.target.value); setDirty(true); setNotice(""); }}
                maxLength={240}
                placeholder="หัวข้อการเรียนการสอน"
                className="min-h-[50px] w-full rounded-2xl border border-[#EAE8E3] bg-[#F9F9F8] px-4 text-sm font-bold text-[#1A1A1A] shadow-inner outline-none transition placeholder:font-normal placeholder:text-[#A6A39D] focus:border-[#2C3E32] focus:bg-white focus:shadow-md"
              />
              <p className="pl-1 text-[11px] text-[#999999]">บันทึกหัวข้อไว้กับคาบเรียนนี้</p>
            </label>

            <div className="relative z-50 min-w-0 space-y-2">
              <span className="flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                <CalendarDays className="h-3 w-3" /> วันที่เข้าเรียน
              </span>
              <button
                type="button"
                onClick={openCalendar}
                aria-expanded={showDatePicker}
                className={"flex min-h-[50px] w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-black text-[#1A1A1A] shadow-inner outline-none transition " + (showDatePicker ? "border-white bg-white/70 shadow-md ring-2 ring-[#2C3E32]/15" : "border-[#EAE8E3] bg-[#F9F9F8] hover:border-[#D1CDC4] hover:bg-white")}
              >
                <span>{thaiDate(date)}</span>
                <CalendarDays className={"h-4 w-4 " + (showDatePicker ? "text-[#2C3E32]" : "text-[#999999]")} />
              </button>

              {showDatePicker && (
                <div className="absolute right-0 top-full z-50 mt-3 w-[min(19rem,calc(100vw-2rem))] rounded-[1.75rem] border border-white/90 bg-white/95 p-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.18)] backdrop-blur-3xl">
                  <div className="mb-4 flex items-center justify-between">
                    <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => setNavDate(new Date(currentYear, currentMonth - 1, 1))} className="rounded-full p-2 text-[#888888] transition hover:bg-[#F4F4F2] hover:text-[#1A1A1A]">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <p className="text-sm font-black text-[#1A1A1A]">{THAI_MONTHS[currentMonth]} {currentYear + 543}</p>
                    <button type="button" aria-label="เดือนถัดไป" onClick={() => setNavDate(new Date(currentYear, currentMonth + 1, 1))} className="rounded-full p-2 text-[#888888] transition hover:bg-[#F4F4F2] hover:text-[#1A1A1A]">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                    {WEEK_DAYS.map((day, index) => <span key={day + index} className="py-1 text-[10px] font-black text-[#999999]">{day}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((cell) => {
                      if (!cell.day) return <span key={cell.key} className="h-9" />;
                      const value = dateValue(currentYear, currentMonth, cell.day);
                      const isSelected = date === value;
                      const today = localDateValue() === value;
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => chooseDate(cell.day)}
                          aria-pressed={isSelected}
                          className={"mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition " + (isSelected ? "bg-gradient-to-b from-[#2C3E32] to-[#1E2B23] text-white shadow-md" : today ? "border border-[#D1CDC4] bg-[#EAE8E3]/60 text-[#1A1A1A]" : "text-[#666666] hover:bg-[#F4F4F2] hover:text-[#1A1A1A]")}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => selectDate(localDateValue())} className="mt-4 w-full rounded-xl border border-[#EAE8E3] py-2 text-xs font-bold text-[#4d5f4a] transition hover:bg-[#F4F4F2]">
                    เลือกวันนี้
                  </button>
                </div>
              )}
            </div>

            <label className="block min-w-0 space-y-2">
              <span className="flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]"><BookOpen className="h-3 w-3" /> คาบเรียน</span>
              <select value={period} onChange={(event) => selectPeriod(event.target.value)} className="min-h-[50px] w-full rounded-2xl border border-[#EAE8E3] bg-[#F9F9F8] px-4 text-sm font-bold text-[#1A1A1A] shadow-inner outline-none transition focus:border-[#2C3E32] focus:bg-white focus:shadow-md">
                {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>คาบ {value}</option>)}
              </select>
              <p className="pl-1 text-[11px] text-[#999999]">บันทึกแยกจากคาบอื่นในวันเดียวกัน</p>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[#EAE8E3]/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#1A1A1A]">{selected ? selected.subject.code + " · " + selected.subject.name : "เลือกวิชาเพื่อเริ่มเช็กชื่อ"}</p>
              <p className="mt-1 text-xs text-[#888888]">{selected?.classroom.name || "—"} · {thaiDate(date)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={markAllPresent}
                disabled={!students.length || loading}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#EAE8E3] bg-white px-4 text-xs font-bold text-[#4d5f4a] shadow-sm transition hover:border-[#D1CDC4] hover:bg-[#F9F9F8] disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" /> เช็กมาทุกคน
              </button>
              <span className="rounded-full bg-[#F4F4F2] px-3 py-2 text-[11px] font-semibold text-[#77736C]">ยังไม่ระบุ {counts.unmarked} คน</span>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white bg-white/85 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.035)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-black tracking-tight text-[#1A1A1A]">ประวัติการเช็กชื่อ</h2><p className="mt-1 text-[11px] text-[#888888]">เลือกวันที่และคาบที่เคยบันทึก เพื่อเปิดดูหรือแก้ไขย้อนหลัง</p></div>
            <span className="rounded-full bg-[#F4F4F2] px-3 py-1.5 text-[10px] font-bold text-[#77736C]">{history.length} รายการล่าสุด</span>
          </div>
          {historyLoading ? <p className="rounded-xl bg-[#F9F9F8] p-5 text-center text-xs text-[#888888]">กำลังโหลดประวัติ...</p> : history.length === 0 ? <p className="rounded-xl bg-[#F9F9F8] p-5 text-center text-xs text-[#888888]">ยังไม่มีประวัติการเช็กชื่อของรายวิชานี้</p> : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => {
                const active = item.date === date && item.period === period;
                return <button key={item.id} type="button" onClick={() => openHistory(item)} aria-pressed={active} className={"rounded-2xl border p-4 text-left transition " + (active ? "border-[#2C3E32] bg-[#EFF5F0] shadow-sm" : "border-[#EAE8E3] bg-white hover:border-[#D1CDC4] hover:bg-[#F9F9F8]")}>
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[#1A1A1A]">{thaiDate(item.date)}</span><span className="rounded-full bg-[#F4F4F2] px-2.5 py-1 text-[10px] font-bold text-[#4d5f4a]">คาบ {item.period}</span></div>
                  <p className="mt-2 truncate text-[11px] text-[#777777]">{item.topic || "ไม่ระบุหัวข้อการสอน"}</p>
                  <p className="mt-3 text-[10px] font-semibold text-[#777777]">มา {item.present} · สาย {item.late} · ลา {item.leave} · ขาด {item.absent} · มีข้อมูล {item.total} คน</p>
                  <p className="mt-2 text-[10px] font-bold text-[#2C3E32]">เปิดรายการเพื่อแก้ไขสถานะย้อนหลัง →</p>
                </button>;
              })}
            </div>
          )}
          {historyHasMore && <div className="mt-4 text-center"><button type="button" onClick={() => void loadHistory(Math.floor(history.length / 100) + 1, true)} disabled={historyLoading} className="rounded-full border border-[#EAE8E3] bg-white px-5 py-2.5 text-xs font-bold text-[#4d5f4a] transition hover:bg-[#F9F9F8] disabled:opacity-50">{historyLoading ? "กำลังโหลด..." : "ดูประวัติเพิ่มเติม"}</button></div>}
        </section>

        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap gap-3">
            {summaryCards.map((item) => {
              const Icon = item.icon;
              const percentage = item.total ? (item.value / item.total) * 100 : 0;
              return (
                <div key={item.label} className="min-w-[calc(33.333%_-_0.5rem)] flex-1 rounded-[1.4rem] border border-[#EAE8E3] bg-white px-4 py-3.5 shadow-sm sm:min-w-[125px] sm:flex-none sm:px-5">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#666666]">{item.label}</span>
                    <Icon className={"h-3.5 w-3.5 " + item.tone} />
                  </div>
                  <p className={"text-2xl font-black tabular-nums " + item.tone}>
                    {item.value}<span className="text-xs font-medium text-[#999999]">/{item.total}</span>
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#F4F4F2]">
                    <div className={"h-full rounded-full " + item.bar} style={{ width: percentage + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
              className="min-h-[48px] w-full rounded-2xl border border-[#EAE8E3] bg-white pl-11 pr-4 text-xs font-bold text-[#1A1A1A] shadow-sm outline-none transition placeholder:font-normal placeholder:text-[#A6A39D] focus:border-[#2C3E32] focus:shadow-md"
            />
          </div>
        </section>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-[#E8C7C4] bg-[#FBF1F0] px-4 py-3 text-sm text-[#8C3A3A]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-2xl border border-[#C9D8CC] bg-[#EFF5F0] px-4 py-3 text-sm font-semibold text-[#2C3E32]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />{notice}
          </div>
        )}

        {loadedSessionId && !loading && (
          <div role="status" className="rounded-2xl border border-[#C9D8CC] bg-[#EFF5F0] px-4 py-3 text-xs font-semibold text-[#2C3E32]">
            กำลังแก้ไขประวัติการเช็กชื่อวันที่ {thaiDate(date)} คาบ {period} · เปลี่ยนสถานะนักเรียนหรือหัวข้อ แล้วกดบันทึกเพื่ออัปเดตรายการเดิม
          </div>
        )}

        <section className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-[#EAE8E3]/80 px-2 pb-3 sm:px-5">
            <div>
              <h2 className="text-sm font-black tracking-tight text-[#1A1A1A]">รายชื่อนักเรียน</h2>
              <p className="mt-1 text-[11px] text-[#888888]">เลือกสถานะการเข้าเรียนของนักเรียนแต่ละคน</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#77736C] shadow-sm">{filteredStudents.length} / {students.length} คน</span>
          </div>

          {loading ? (
            <div className="rounded-[1.5rem] border border-[#EAE8E3] bg-white p-12 text-center text-sm text-[#788174] shadow-sm">กำลังโหลดข้อมูล...</div>
          ) : students.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[#D1CDC4] bg-white/60 p-12 text-center text-sm text-[#788174]">
              {assignments.length ? "ยังไม่มีนักเรียนในห้องเรียนนี้" : "เพิ่มรายวิชาและผูกห้องเรียนก่อนเริ่มเช็กชื่อ"}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[#D1CDC4] bg-white/60 p-12 text-center text-sm text-[#788174]">
              <Search className="mx-auto mb-3 h-7 w-7 text-[#CCCCCC]" />
              ไม่พบรายชื่อนักเรียนที่ค้นหา
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <article key={student.id} className="group flex flex-col justify-between gap-4 rounded-[1.5rem] border border-[#EAE8E3] bg-white p-4 shadow-sm transition duration-200 hover:border-white hover:shadow-lg md:flex-row md:items-center sm:px-6 sm:py-4">
                  <div className="flex min-w-0 items-center gap-4 md:w-1/2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#EAE8E3] bg-[#F4F4F2] text-sm font-black text-[#1A1A1A] transition group-hover:scale-105">
                      {student.rollNo || "—"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black tracking-tight text-[#1A1A1A]">{student.name}</h3>
                      <p className="mt-1 text-[11px] font-bold text-[#8B7A66]">รหัสประจำตัว: {student.studentNo}</p>
                    </div>
                  </div>

                  <div className="relative flex w-full items-center justify-between gap-1 rounded-[1.2rem] border border-[#EAE8E3] bg-[#F4F4F2] p-1.5 shadow-inner md:w-1/2">
                    {STATUS_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = student.attendance === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setStatus(student.id, option.value)}
                          className={"relative z-10 flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[10px] font-black transition duration-200 sm:flex-row sm:gap-1.5 sm:text-[11px] " + (isSelected ? option.selectedClass : "border-transparent text-[#888888] hover:bg-white/70 hover:text-[#1A1A1A]")}
                        >
                          <Icon className={"h-3.5 w-3.5 " + (isSelected ? "text-white" : "text-[#999999]")} />
                          <span className="tracking-wide">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="px-2 text-[11px] leading-6 text-[#8A9384]">
          สถานะจะยังไม่ถูกบันทึกจนกว่าจะกดปุ่มบันทึกด้านล่าง · การเลือก “ลา” จะไม่ถูกเปลี่ยนเป็น “มา” โดยอัตโนมัติ
        </p>
      </main>

      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-[60] px-3 sm:bottom-6 sm:px-4">
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-[1.75rem] border border-white/90 bg-white/85 p-2 pl-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">สถานะข้อมูล</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-black text-[#1A1A1A]">
              {saving ? (
                <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#2C3E32]/20 border-t-[#2C3E32]" /> กำลังบันทึก...</>
              ) : dirty ? (
                <><span className="h-2 w-2 rounded-full bg-[#B88059]" /> มีรายการรอบันทึก</>
              ) : notice ? (
                <span className="flex items-center gap-1 text-[#2C3E32]"><CheckCircle2 className="h-3.5 w-3.5" /> บันทึกเรียบร้อย</span>
              ) : (
                "ข้อมูลพร้อมใช้งาน"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={saveAttendance}
            disabled={!assignmentId || loading || saving || students.length === 0 || !dirty}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[1.25rem] bg-gradient-to-r from-[#1A1A1A] to-[#333333] px-5 text-xs font-black text-white shadow-md transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-45 sm:px-6"
          >
            {saving ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> กำลังซิงค์...</>
            ) : notice && !dirty ? (
              <><CheckCircle2 className="h-4 w-4" /> บันทึกแล้ว</>
            ) : (
              <><Save className="h-4 w-4" /> {loadedSessionId ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
