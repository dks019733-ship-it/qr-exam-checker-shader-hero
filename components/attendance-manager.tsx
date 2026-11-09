"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, CheckCheck, Clock3, Search, Save, Users, X } from "lucide-react";

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
  session: { id: string; date: string; topic: string } | null;
  classroom: { id: string; name: string };
  subject: { code: string; name: string };
  students: StudentRow[];
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; short: string; className: string }[] = [
  { value: "PRESENT", label: "มา", short: "มา", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "LATE", label: "สาย", short: "สาย", className: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "LEAVE", label: "ลา", short: "ลา", className: "border-sky-200 bg-sky-50 text-sky-800" },
  { value: "ABSENT", label: "ขาด", short: "ขาด", className: "border-rose-200 bg-rose-50 text-rose-800" },
];

function localDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function thaiDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function AttendanceManager() {
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState(localDateValue);
  const [topic, setTopic] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      .catch((err) => { if (active) setError(err.message || "เกิดข้อผิดพลาด"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!assignmentId || !date) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({ teachingAssignmentId: assignmentId, date });
      const response = await fetch(`/api/attendance?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดข้อมูลเช็กชื่อไม่สำเร็จ");
      setStudents(data.students);
      setTopic(data.session?.topic || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, date]);

  useEffect(() => { void loadAttendance(); }, [loadAttendance]);

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

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStudents((current) => current.map((student) =>
      student.id === studentId ? { ...student, attendance: status } : student,
    ));
  }

  function markAllPresent() {
    setStudents((current) => current.map((student) =>
      student.attendance === "LEAVE" ? student : { ...student, attendance: "PRESENT" },
    ));
  }

  async function saveAttendance() {
    if (!assignmentId || !date) return;
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
      setNotice(`บันทึกสถานะนักเรียน ${data.savedRecords} คนแล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const selected = assignments.find((assignment) => assignment.id === assignmentId);

  return (
    <main className="min-h-screen bg-[#f8f7f4] px-4 py-8 text-[#1c241b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71816c]">CLASSROOM MANAGEMENT</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">เช็กชื่อเข้าเรียน</h1>
            <p className="mt-2 text-sm text-[#687565]">บันทึกและติดตามสถานะการเข้าเรียนแยกตามรายวิชาและวันที่</p>
          </div>
          <button
            type="button"
            onClick={saveAttendance}
            disabled={!assignmentId || loading || saving || students.length === 0}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4d5f4a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#374535] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />{saving ? "กำลังบันทึก..." : "บันทึกการเช็กชื่อ"}
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "นักเรียนทั้งหมด", value: students.length, icon: Users, tone: "text-slate-700 bg-slate-100" },
            { label: "มา", value: counts.PRESENT, icon: Check, tone: "text-emerald-800 bg-emerald-50" },
            { label: "สาย", value: counts.LATE, icon: Clock3, tone: "text-amber-800 bg-amber-50" },
            { label: "ลา", value: counts.LEAVE, icon: CalendarDays, tone: "text-sky-800 bg-sky-50" },
            { label: "ขาด", value: counts.ABSENT, icon: X, tone: "text-rose-800 bg-rose-50" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-[#e6e8df] bg-white p-4 shadow-sm">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}><Icon className="h-4 w-4" /></div>
                <p className="mt-3 text-xs font-medium text-[#788174]">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-[#e6e8df] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_1.2fr]">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#687565]">รายวิชา / ห้องเรียน</span>
              <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} disabled={loading && assignments.length === 0} className="min-h-11 w-full rounded-xl border border-[#dfe4d8] bg-white px-3 text-sm outline-none focus:border-[#718b6b] focus:ring-2 focus:ring-[#718b6b]/15">
                {assignments.length === 0 && <option value="">ยังไม่มีรายวิชาที่กำหนด</option>}
                {assignments.map((item) => <option key={item.id} value={item.id}>{item.subject.code} · {item.subject.name} — {item.classroom.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#687565]">วันที่เข้าเรียน</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#dfe4d8] bg-white px-3 text-sm outline-none focus:border-[#718b6b] focus:ring-2 focus:ring-[#718b6b]/15" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#687565]">หัวข้อ / บันทึกประจำคาบ</span>
              <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} placeholder="เช่น ระบบหมุนเวียนเลือดและภูมิคุ้มกัน" className="min-h-11 w-full rounded-xl border border-[#dfe4d8] px-3 text-sm outline-none focus:border-[#718b6b] focus:ring-2 focus:ring-[#718b6b]/15" />
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-[#edf0e9] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">{selected ? `${selected.subject.code} · ${selected.subject.name}` : "เลือกวิชา"}</p>
              <p className="mt-1 text-xs text-[#778173]">{selected?.classroom.name || "—"} · {thaiDate(date)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={markAllPresent} disabled={!students.length} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dfe4d8] px-3 text-xs font-semibold text-[#4d5f4a] hover:bg-[#f4f6f1] disabled:opacity-50">
                <CheckCheck className="h-4 w-4" />เลือกมาให้ทุกคน
              </button>
              <span className="text-xs text-[#788174]">ยังไม่ระบุ {counts.unmarked} คน</span>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <section className="overflow-hidden rounded-2xl border border-[#e6e8df] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#edf0e9] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-base font-bold">รายชื่อนักเรียน</h2>
              <p className="mt-1 text-xs text-[#788174]">เลือกสถานะของนักเรียนแต่ละคน แล้วกดบันทึก</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9384]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ เลขที่ หรือรหัสนักเรียน" className="min-h-10 w-full rounded-xl border border-[#dfe4d8] pl-9 pr-3 text-sm outline-none focus:border-[#718b6b]" />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-[#788174]">กำลังโหลดข้อมูล...</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#788174]">{assignments.length ? "ยังไม่มีนักเรียนในห้องเรียนนี้" : "เพิ่มรายวิชาและผูกห้องเรียนก่อนเริ่มเช็กชื่อ"}</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#788174]">ไม่พบนักเรียนที่ตรงกับคำค้นหา</div>
          ) : (
            <div className="divide-y divide-[#edf0e9]">
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f3eb] text-sm font-bold text-[#4d5f4a]">{student.rollNo || "—"}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{student.name}</p>
                      <p className="mt-1 text-xs text-[#788174]">เลขที่ {student.rollNo || "—"} · รหัส {student.studentNo}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:w-[340px]">
                    {STATUS_OPTIONS.map((option) => (
                      <button key={option.value} type="button" aria-pressed={student.attendance === option.value} onClick={() => setStatus(student.id, option.value)} className={`min-h-10 rounded-lg border px-2 text-xs font-bold transition ${student.attendance === option.value ? option.className + " ring-2 ring-current/10" : "border-[#e6e8df] bg-white text-[#687565] hover:bg-[#f8f9f6]"}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <p className="text-xs leading-6 text-[#8a9384]">สถานะจะยังไม่ถูกบันทึกจนกว่าจะกดปุ่ม “บันทึกการเช็กชื่อ” · การเลือก “ลา” จะไม่ถูกเปลี่ยนเป็น “มา” โดยอัตโนมัติ</p>
      </div>
    </main>
  );
}
