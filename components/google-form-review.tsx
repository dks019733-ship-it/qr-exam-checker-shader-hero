"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, Loader2, Save } from "lucide-react";

type Question = {
  id: string;
  title: string;
  points: number;
  correctAnswers: string[];
  choices: string[];
};
type Answer = Question & { answer: string; score: number };
type StudentOption = { id: string; rollNo: string; studentNo: string; name: string; className: string };
type ReviewResponse = {
  responseId: string;
  submittedAt: string | null;
  rollNo: string;
  formRoom: string;
  room: string;
  manualReviewRequired: boolean;
  studentName: string;
  studentId: string | null;
  matchedStudent: { rollNo: string; studentNo: string; name: string; className: string } | null;
  score: number;
  questionScores: Record<string, number>;
  answers: Answer[];
};
type Payload = {
  column: { id: string; title: string; className: string; maxScore: number };
  questions: Question[];
  classrooms: { id: string; name: string }[];
  students: StudentOption[];
  responses: ReviewResponse[];
};

const inputClass = "w-24 rounded-lg border border-[#d9dfd5] bg-white px-3 py-2 text-center text-sm outline-none focus:border-[#81927e] focus:ring-2 focus:ring-[#e0e8e0]";

export function GoogleFormReview({ columnId }: { columnId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [studentIds, setStudentIds] = useState<Record<string, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savedScores, setSavedScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsGoogleReauth, setNeedsGoogleReauth] = useState(false);
  const [roomFilter, setRoomFilter] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch(`/api/gradebook/columns/${encodeURIComponent(columnId)}/review`);
      const body = await response.json().catch(() => null);
      setNeedsGoogleReauth(body?.action === "reauthorize");
      if (!response.ok) throw new Error(body?.error || "โหลดคำตอบไม่สำเร็จ");
      const data = body as Payload;
      setPayload(data);
      setSelectedId((current) => data.responses.some((item) => item.responseId === current) ? current : data.responses[0]?.responseId || "");
      setStudentIds((current) => Object.fromEntries(data.responses.map((item) => [item.responseId, current[item.responseId] ?? item.studentId ?? ""])));
      setScoreDrafts((current) => Object.fromEntries(data.responses.map((item) => [
        item.responseId,
        current[item.responseId] ?? Object.fromEntries(item.answers.map((answer) => [answer.id, String(answer.score)])),
      ])));
      setSavedScores(Object.fromEntries(data.responses.map((item) => [item.responseId, item.score])));
      setLastUpdated(new Date().toLocaleTimeString("th-TH"));
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : "โหลดคำตอบไม่สำเร็จ");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [columnId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const roomOptions = useMemo(() => [...new Set([
    ...(payload?.classrooms || []).map((classroom) => classroom.name.trim()),
    ...(payload?.responses || []).map((item) => item.room.trim()),
  ].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "th", { numeric: true })), [payload]);
  const hasUnspecifiedRoom = (payload?.responses || []).some((item) => !item.room.trim());
  const visibleResponses = useMemo(() => (payload?.responses || []).filter((item) => !roomFilter
    || (roomFilter === "__no_room__" ? !item.room.trim() : item.room.trim() === roomFilter)), [payload, roomFilter]);
  const selected = visibleResponses.find((item) => item.responseId === selectedId);
  const currentQuestionScores = selected ? scoreDrafts[selected.responseId] || {} : {};
  const currentTotal = useMemo(() => selected?.answers.reduce((total, answer) => total + (Number(currentQuestionScores[answer.id]) || 0), 0) || 0, [selected, currentQuestionScores]);

  useEffect(() => {
    if (visibleResponses.length && !visibleResponses.some((item) => item.responseId === selectedId)) {
      setSelectedId(visibleResponses[0].responseId);
    }
  }, [visibleResponses, selectedId]);

  function updateQuestionScore(questionId: string, value: string) {
    if (!selected) return;
    setScoreDrafts((current) => ({
      ...current,
      [selected.responseId]: { ...(current[selected.responseId] || {}), [questionId]: value },
    }));
  }

  async function saveReview() {
    if (!selected) return;
    const studentId = studentIds[selected.responseId] || "";
    if (!studentId) {
      setError("กรุณาเลือกนักเรียนให้คำตอบนี้ก่อนบันทึกคะแนน");
      return;
    }
    const questionScores: Record<string, number> = {};
    for (const answer of selected.answers) {
      const raw = currentQuestionScores[answer.id] ?? "";
      const score = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(score) || score < 0 || score > answer.points) {
        setError(`กรุณาตรวจคะแนนข้อ “${answer.title}” ให้เป็นตัวเลขตั้งแต่ 0 ถึง ${answer.points}`);
        return;
      }
      questionScores[answer.id] = score;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/gradebook/columns/${encodeURIComponent(columnId)}/review`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responseId: selected.responseId, studentId, questionScores }),
      });
      const body = await response.json().catch(() => null);
      setNeedsGoogleReauth(body?.action === "reauthorize");
      if (!response.ok) throw new Error(body?.error || "บันทึกคะแนนไม่สำเร็จ");
      setSavedScores((current) => ({ ...current, [selected.responseId]: body.score }));
      const savedStudent = payload?.students.find((student) => student.id === studentId);
      if (savedStudent) {
        setPayload((current) => current ? {
          ...current,
          responses: current.responses.map((item) => item.responseId === selected.responseId ? {
            ...item,
            studentId,
            room: savedStudent.className,
            matchedStudent: { rollNo: savedStudent.rollNo, studentNo: savedStudent.studentNo, name: savedStudent.name, className: savedStudent.className },
            score: body.score,
          } : item),
        } : current);
      }
      setNotice(`บันทึกคะแนน ${body.score} คะแนนเข้าคะแนนของนักเรียนแล้ว`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกคะแนนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen bg-[#f3f1e9] p-4 text-[#303832] sm:p-8">
    <div className="mx-auto max-w-7xl">
      <Link href="/dashboard/gradebook" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" />กลับสมุดคะแนน</Link>
      <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">ตรวจคำตอบและให้คะแนนรายคน</h1>
        <p className="mt-2 text-sm text-slate-600">{payload ? `${payload.column.title} · ${payload.column.className}` : "แสดงโจทย์ คำตอบของนักเรียน และเฉลยที่ตั้งไว้ใน Google Forms"}</p>
        {payload && <p className="mt-1 text-xs text-slate-500">คะแนนจะบันทึกลงสมุดคะแนนเมื่อกดบันทึก · คำตอบ {payload.responses.length} รายการ · คะแนนเต็มฟอร์ม {payload.column.maxScore} · อัปเดตล่าสุด {lastUpdated || "—"} · รีเฟรชอัตโนมัติทุก 15 วินาที</p>}
      </header>
      {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{needsGoogleReauth && <button onClick={() => void signIn("google", { redirectTo: window.location.href })} className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-2 font-medium">ยืนยันสิทธิ์ Google ใหม่</button>}</div>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <div className="mt-6 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลดคำตอบจาก Google Forms</div> : !payload ? null : !payload.responses.length ? <section className="mt-5 rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">ยังไม่มีคำตอบในฟอร์ม</section> : <div className="mt-5 grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="max-h-[75vh] overflow-y-auto rounded-2xl border bg-white p-3 shadow-sm">
          <div className="sticky top-0 z-10 rounded-xl bg-white px-2 pb-2 pt-1"><h2 className="py-2 text-sm font-semibold">คำตอบตามห้อง ({visibleResponses.length}/{payload.responses.length})</h2><select aria-label="กรองคำตอบตามห้อง" className="w-full rounded-lg border border-[#d9dfd5] bg-white px-3 py-2 text-sm" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}><option value="">ทุกห้อง</option>{roomOptions.map((room) => <option key={room} value={room}>{room}</option>)}{hasUnspecifiedRoom && <option value="__no_room__">ไม่ได้ระบุห้อง</option>}</select></div>
          {visibleResponses.map((item, index) => {
            const student = item.matchedStudent;
            const label = student ? `${student.rollNo || student.studentNo} · ${student.name}` : `${item.rollNo || "ไม่ทราบเลขที่"} · ${item.studentName || "ไม่ทราบชื่อ"}`;
            const previousRoom = index > 0 ? visibleResponses[index - 1].room.trim() : "";
            const roomHeading = !roomFilter && item.room.trim() !== previousRoom;
            return <div key={item.responseId}>
              {roomHeading && <h3 className="sticky top-[5.6rem] z-[5] mt-2 bg-[#f7f6f0] px-3 py-2 text-xs font-semibold text-slate-600">{item.room ? `ห้อง ${item.room}` : "ไม่ได้ระบุห้อง"}</h3>}
              <button onClick={() => { setSelectedId(item.responseId); setError(""); setNotice(""); }} className={`mb-1 w-full rounded-xl p-3 text-left ${selectedId === item.responseId ? "bg-[#eaf0e8] ring-1 ring-[#81927e]" : "hover:bg-slate-50"}`}>
                <span className="block truncate text-sm font-medium">{label}</span>
                <span className={`mt-1 block text-xs ${student && !item.manualReviewRequired ? "text-slate-500" : "font-medium text-amber-700"}`}>{item.room ? `ห้อง ${item.room} · ` : "ไม่ระบุห้อง · "}{item.manualReviewRequired ? "ตรวจจับคู่เอง" : student ? "จับคู่แล้ว" : "ยังไม่จับคู่นักเรียน"} · {savedScores[item.responseId] ?? item.score} คะแนน</span>
              </button>
            </div>;
          })}
        </aside>
        {!visibleResponses.length ? <section className="min-w-0 rounded-2xl border bg-white p-8 text-center text-sm text-slate-600 shadow-sm">ไม่มีคำตอบในห้องที่เลือก</section> : selected && <section className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-[#faf9f5] p-4 sm:p-5">
            <div className="min-w-0"><h2 className="text-lg font-semibold">{selected.matchedStudent ? `${selected.matchedStudent.className} · เลขที่ ${selected.matchedStudent.rollNo || selected.matchedStudent.studentNo} · ${selected.matchedStudent.name}` : `${selected.rollNo ? `เลขที่ ${selected.rollNo} · ` : ""}${selected.studentName === "ไม่ระบุชื่อในฟอร์ม" ? "ไม่ได้กรอกชื่อ" : selected.studentName || "ยังไม่ระบุชื่อ"}`}</h2><p className="mt-1 text-xs text-slate-500">{selected.submittedAt ? new Date(selected.submittedAt).toLocaleString("th-TH") : "ไม่พบเวลาส่งคำตอบ"} · ห้องในฟอร์ม {selected.formRoom || "ไม่ระบุ"}{selected.matchedStudent && selected.room !== selected.formRoom ? ` · บันทึกเข้าห้อง ${selected.room}` : ""} · คะแนนเดิมจากฟอร์ม {selected.score}</p></div>
            <label className="grid gap-1 text-xs font-medium">จับคู่กับนักเรียน<select className="min-w-64 rounded-lg border border-[#d9dfd5] bg-white px-3 py-2 text-sm" value={studentIds[selected.responseId] || ""} onChange={(event) => setStudentIds((current) => ({ ...current, [selected.responseId]: event.target.value }))}><option value="">เลือกนักเรียน</option>{payload.students.map((student) => <option key={student.id} value={student.id}>{student.className} · {student.rollNo || student.studentNo} · {student.name} ({student.studentNo})</option>)}</select></label>
          </div>
          {!selected.answers.length ? <p className="p-6 text-sm text-slate-600">ไม่พบข้อสอบที่มีคะแนนในฟอร์มนี้</p> : <div className="divide-y">{selected.answers.map((answer, index) => {
            const chosen = new Set(answer.answer.split(" · ").map((value) => value.trim()));
            return <article key={answer.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1"><h3 className="font-semibold">{answer.title}</h3><p className="mt-3 rounded-xl bg-[#f7f6f0] p-3 text-sm"><span className="font-medium">คำตอบของนักเรียน: </span>{answer.answer}</p></div>
                <label className="grid shrink-0 gap-1 text-xs font-medium">คะแนน / {answer.points}<input type="number" min="0" max={answer.points} step="0.01" className={inputClass} value={currentQuestionScores[answer.id] ?? ""} onChange={(event) => updateQuestionScore(answer.id, event.target.value)} aria-label={`คะแนนข้อ ${index + 1}`} /></label>
              </div>
              {!!answer.choices.length && <div className="mt-3 grid gap-2 sm:grid-cols-2">{answer.choices.map((choice, choiceIndex) => {
                const isSelected = chosen.has(choice);
                const isCorrect = answer.correctAnswers.includes(choice);
                return <div key={`${answer.id}-${choiceIndex}`} className={`rounded-lg border px-3 py-2 text-sm ${isSelected && isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900" : isSelected ? "border-blue-300 bg-blue-50 text-blue-900" : isCorrect ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : "border-slate-200"}`}>
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + choiceIndex)}.</span>{choice}
                  {isSelected && <span className="ml-2 text-xs font-semibold">นักเรียนเลือก</span>}
                  {isCorrect && <span className="ml-2 text-xs font-semibold">เฉลย</span>}
                </div>;
              })}</div>}
            </article>;
          })}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-[#faf9f5] p-4 sm:p-5">
            <p className="text-sm font-semibold">รวม {currentTotal} / {selected.answers.reduce((total, answer) => total + answer.points, 0)} คะแนน</p>
            <button onClick={() => void saveReview()} disabled={saving || !selected.answers.length} className="inline-flex items-center rounded-xl bg-[#425a49] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="mr-2 h-4 w-4" />{saving ? "กำลังบันทึก..." : "บันทึกคะแนนให้คนนี้"}</button>
          </div>
        </section>}
      </div>}
    </div>
  </main>;
}
