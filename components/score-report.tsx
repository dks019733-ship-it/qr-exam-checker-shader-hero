"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Loader2, RefreshCw, Search, Users } from "lucide-react";

type Attempt = {
  id: string;
  score: number | null;
  status: string;
  student: { rollNo: string; studentNo: string; name: string };
};
type ExamReport = {
  id: string;
  title: string;
  subject: string;
  class: { id: string; name: string } | null;
  attempts: Attempt[];
  _count: { questions: number };
};

const formatScore = (value: number) =>
  value.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export function ScoreReport() {
  const [exams, setExams] = useState<ExamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [classId, setClassId] = useState("all");
  const [examId, setExamId] = useState("");
  const [search, setSearch] = useState("");
  const [confirmingAttemptId, setConfirmingAttemptId] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "โหลดรายงานคะแนนไม่สำเร็จ");
      setExams(Array.isArray(body) ? body : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดรายงานคะแนนไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const classrooms = useMemo(() => {
    const unique = new Map<string, string>();
    exams.forEach((exam) => {
      if (exam.class) unique.set(exam.class.id, exam.class.name);
    });
    return Array.from(unique, ([id, name]) => ({ id, name }));
  }, [exams]);

  const visibleExams = useMemo(
    () => classId === "all" ? exams : exams.filter((exam) => exam.class?.id === classId),
    [classId, exams],
  );
  const selectedExam = visibleExams.find((exam) => exam.id === examId) || visibleExams[0] || null;

  const visibleAttempts = useMemo(() => {
    if (!selectedExam) return [];
    const query = search.trim().toLocaleLowerCase("th-TH");
    const attempts = selectedExam.attempts;
    if (!query) return attempts;
    return attempts.filter((attempt) =>
      [attempt.student.name, attempt.student.rollNo, attempt.student.studentNo]
        .some((value) => String(value || "").toLocaleLowerCase("th-TH").includes(query)),
    );
  }, [search, selectedExam]);

  const scoredAttempts = selectedExam?.attempts.filter(
    (attempt): attempt is Attempt & { score: number } => attempt.score !== null,
  ) || [];
  const average = scoredAttempts.length
    ? scoredAttempts.reduce((total, attempt) => total + attempt.score, 0) / scoredAttempts.length
    : null;
  const highest = scoredAttempts.length
    ? Math.max(...scoredAttempts.map((attempt) => attempt.score))
    : null;
  const pendingCount = selectedExam?.attempts.filter((attempt) => attempt.status !== "CONFIRMED").length || 0;

  async function confirm(exam: ExamReport, attempt: Attempt) {
    setMessage("");
    setConfirmingAttemptId(attempt.id);
    try {
      const response = await fetch(
        "/api/exams/" + exam.id + "/attempts/" + attempt.id + "/confirm",
        { method: "POST" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "ยืนยันคะแนนไม่สำเร็จ");
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ยืนยันคะแนนไม่สำเร็จ");
    } finally {
      setConfirmingAttemptId("");
    }
  }

  function exportCsv(exam: ExamReport) {
    const safe = (value: unknown) => {
      const text = String(value ?? "");
      const protectedText = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
      return '"' + protectedText.replaceAll('"', '""') + '"';
    };
    const rows = [
      ["เลขที่", "รหัสนักเรียน", "ชื่อ", "ข้อสอบ", "ห้อง", "คะแนน", "คะแนนเต็ม", "สถานะ"],
      ...exam.attempts.map((attempt) => [
        attempt.student.rollNo,
        attempt.student.studentNo,
        attempt.student.name,
        exam.title,
        exam.class?.name || "",
        attempt.score ?? "",
        exam._count.questions,
        attempt.status === "CONFIRMED" ? "ยืนยันแล้ว" : "รอตรวจสอบ",
      ]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scores-" + exam.id + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5" aria-labelledby="score-report-title">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6e5dc] bg-white p-5 shadow-sm sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-[#4d5f4a]">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold">ผลการประเมิน</span>
          </div>
          <h2 id="score-report-title" className="mt-1 text-xl font-bold text-[#26382b]">สรุปคะแนนสอบ</h2>
          <p className="mt-1 text-sm text-[#697568]">ตรวจสอบผลสอบ ยืนยันคะแนน และส่งออกข้อมูลรายห้องเรียน</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dfe4d8] px-3 py-2 text-xs font-semibold text-[#435541] transition hover:bg-[#f4f6f0] disabled:opacity-50"
        >
          <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
          รีเฟรชข้อมูล
        </button>
      </header>

      {message && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-[#e6e5dc] bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-[#4d5f4a]" aria-label="กำลังโหลดรายงานคะแนน" />
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9dfd3] bg-white px-5 py-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-[#9aa694]" />
          <p className="mt-3 text-sm font-semibold text-[#354535]">ยังไม่มีผลสอบ</p>
          <p className="mt-1 text-xs text-[#788374]">เมื่อมีการบันทึกคำตอบของนักเรียน ผลสอบจะแสดงในส่วนนี้</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-[#e6e5dc] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#596854]">
              <Users className="h-4 w-4" /> เลือกห้องเรียน
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามห้องเรียน">
              <button
                type="button"
                onClick={() => { setClassId("all"); setExamId(""); }}
                aria-pressed={classId === "all"}
                className={"rounded-xl px-4 py-2 text-xs font-semibold transition " + (classId === "all" ? "bg-[#304a38] text-white shadow-sm" : "bg-[#f2f4ef] text-[#5e6d5b] hover:bg-[#e8ede4]")}
              >
                ทุกห้อง
              </button>
              {classrooms.map((classroom) => (
                <button
                  type="button"
                  key={classroom.id}
                  onClick={() => { setClassId(classroom.id); setExamId(""); }}
                  aria-pressed={classId === classroom.id}
                  className={"rounded-xl px-4 py-2 text-xs font-semibold transition " + (classId === classroom.id ? "bg-[#304a38] text-white shadow-sm" : "bg-[#f2f4ef] text-[#5e6d5b] hover:bg-[#e8ede4]")}
                >
                  {classroom.name}
                </button>
              ))}
            </div>
            <label className="block text-xs font-semibold text-[#596854]">
              เลือกชุดข้อสอบ
              <select
                value={selectedExam?.id || ""}
                onChange={(event) => setExamId(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe4d8] bg-[#fffefa] px-3 text-sm font-medium text-[#303832] outline-none focus:border-[#7c9276] focus:ring-2 focus:ring-[#dce6d7]"
              >
                {visibleExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}{exam.class?.name ? " · " + exam.class.name : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedExam && (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-[#304a38] to-[#1f3427] p-5 text-white shadow-lg shadow-[#304a38]/10 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-wide text-[#e4eadf]">
                      {selectedExam.class?.name || "ไม่ระบุห้องเรียน"}
                    </span>
                    <h3 className="mt-2 text-lg font-bold">{selectedExam.title}</h3>
                    <p className="mt-1 text-xs text-white/65">{selectedExam.subject || "ไม่ระบุรายวิชา"} · {selectedExam._count.questions} ข้อ</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportCsv(selectedExam)}
                    disabled={!selectedExam.attempts.length}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#304a38] transition hover:bg-[#eef2ea] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" /> ดาวน์โหลด CSV
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] text-white/65">ส่งคำตอบ</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{selectedExam.attempts.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/65">คะแนนเฉลี่ย</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{average === null ? "—" : formatScore(average) + " / " + selectedExam._count.questions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/65">คะแนนสูงสุด</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{highest === null ? "—" : formatScore(highest) + " / " + selectedExam._count.questions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/65">รอยืนยัน</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{pendingCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#e6e5dc] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#2c3d2e]">ผลคะแนนรายบุคคล</h3>
                    <p className="mt-1 text-xs text-[#788374]">แสดง {visibleAttempts.length} จาก {selectedExam.attempts.length} รายการ</p>
                  </div>
                  <label className="relative block w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9685]" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="ค้นหาชื่อ เลขที่ หรือรหัสนักเรียน"
                      className="min-h-10 w-full rounded-xl border border-[#dfe4d8] bg-[#fffefa] py-2 pl-9 pr-3 text-xs outline-none transition focus:border-[#7c9276] focus:ring-2 focus:ring-[#dce6d7]"
                    />
                  </label>
                </div>

                {visibleAttempts.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#788374]">
                    {selectedExam.attempts.length ? "ไม่พบรายชื่อนักเรียนที่ตรงกับคำค้น" : "ยังไม่มีผลสอบที่บันทึก"}
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-[#f4f6f0] text-xs text-[#596854]">
                        <tr>
                          <th className="rounded-l-lg p-3 font-semibold">เลขที่</th>
                          <th className="p-3 font-semibold">รหัสนักเรียน</th>
                          <th className="p-3 font-semibold">ชื่อ-นามสกุล</th>
                          <th className="p-3 text-right font-semibold">คะแนน</th>
                          <th className="p-3 font-semibold">สถานะ</th>
                          <th className="rounded-r-lg p-3 text-right font-semibold">การทำงาน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAttempts.map((attempt) => (
                          <tr key={attempt.id} className="border-b border-[#edf0e9] last:border-0">
                            <td className="p-3 text-[#657365]">{attempt.student.rollNo || "—"}</td>
                            <td className="p-3 text-[#657365]">{attempt.student.studentNo || "—"}</td>
                            <td className="p-3 font-medium text-[#303b31]">{attempt.student.name}</td>
                            <td className="p-3 text-right font-semibold tabular-nums text-[#304a38]">
                              {attempt.score === null ? "—" : formatScore(attempt.score) + " / " + selectedExam._count.questions}
                            </td>
                            <td className="p-3">
                              {attempt.status === "CONFIRMED"
                                ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">ยืนยันแล้ว</span>
                                : <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">รอยืนยัน</span>}
                            </td>
                            <td className="p-3 text-right">
                              {attempt.status !== "CONFIRMED" && (
                                <button
                                  type="button"
                                  onClick={() => void confirm(selectedExam, attempt)}
                                  disabled={confirmingAttemptId === attempt.id}
                                  className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#dfe4d8] px-3 py-1.5 text-xs font-semibold text-[#435541] transition hover:bg-[#f4f6f0] disabled:opacity-50"
                                >
                                  {confirmingAttemptId === attempt.id ? "กำลังยืนยัน..." : "ยืนยันคะแนน"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
