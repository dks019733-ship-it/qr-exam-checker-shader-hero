"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

type Attempt = { id: string; score: number | null; status: string; student: { rollNo: string; studentNo: string; name: string } };
type ExamReport = { id: string; title: string; subject: string; class: { name: string } | null; attempts: Attempt[]; _count: { questions: number } };

export function ScoreReport() {
  const [exams, setExams] = useState<ExamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    try { const response = await fetch("/api/reports"); if (!response.ok) throw new Error("โหลดรายงานไม่สำเร็จ"); setExams(await response.json()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "โหลดรายงานไม่สำเร็จ"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function confirm(examId: string, attemptId: string) {
    setMessage("");
    const response = await fetch("/api/exams/" + examId + "/attempts/" + attemptId + "/confirm", { method: "POST" });
    if (!response.ok) { const body = await response.json().catch(() => null); return setMessage(body?.error || "ยืนยันคะแนนไม่สำเร็จ"); }
    await load();
  }

  function exportCsv(exam: ExamReport) {
    const safe = (value: unknown) => {
      const text = String(value ?? "");
      const protectedText = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
      return '"' + protectedText.replaceAll('"', '""') + '"';
    };
    const rows = [["เลขที่", "รหัสนักเรียน", "ชื่อ", "ข้อสอบ", "ห้อง", "คะแนน", "คะแนนเต็ม", "สถานะ"],
      ...exam.attempts.map((attempt) => [attempt.student.rollNo, attempt.student.studentNo, attempt.student.name, exam.title, exam.class?.name || "", attempt.score ?? "", exam._count.questions, attempt.status === "CONFIRMED" ? "ยืนยันแล้ว" : "รอตรวจสอบ"])];
    const csv = "\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "scores-" + exam.id + ".csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" />กลับแดชบอร์ด</Link>
    <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">รายงานคะแนน</h1><p className="mt-2 text-sm text-slate-600">ตรวจคะแนน รอยืนยัน และดาวน์โหลด CSV เพื่อเปิดใน Excel หรือใช้ต่อกับ Google Forms</p></div><div className="flex gap-2"><Link href="/dashboard/gradebook" className="rounded-lg border px-3 py-2 text-sm">สมุดคะแนนรวม</Link><Link href="/dashboard/scan" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">บันทึกคำตอบ</Link></div></div></header>
    {message && <p role="status" className="mt-4 rounded-xl border bg-white p-3 text-sm">{message}</p>}
    {loading ? <Loader2 className="mt-6 h-5 w-5 animate-spin" /> : exams.map((exam) => <section key={exam.id} className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">{exam.title}</h2><p className="mt-1 text-sm text-slate-600">{exam.subject} · {exam.class?.name || "ไม่ระบุห้อง"} · {exam.attempts.length} คน · เต็ม {exam._count.questions}</p></div><button onClick={() => exportCsv(exam)} disabled={!exam.attempts.length} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Download className="mr-2 h-4 w-4" />ดาวน์โหลด CSV</button></div>
      {!exam.attempts.length ? <p className="p-5 text-sm text-slate-500">ยังไม่มีผลสอบที่บันทึก</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">เลขที่</th><th className="p-3">รหัสนักเรียน</th><th className="p-3">ชื่อ</th><th className="p-3">คะแนน</th><th className="p-3">สถานะ</th><th className="p-3">การทำงาน</th></tr></thead><tbody>{exam.attempts.map((attempt) => <tr key={attempt.id} className="border-t"><td className="p-3">{attempt.student.rollNo}</td><td className="p-3">{attempt.student.studentNo}</td><td className="p-3">{attempt.student.name}</td><td className="p-3">{attempt.score} / {exam._count.questions}</td><td className="p-3">{attempt.status === "CONFIRMED" ? "ยืนยันแล้ว" : "รอยืนยัน"}</td><td className="p-3">{attempt.status !== "CONFIRMED" && <button onClick={() => confirm(exam.id, attempt.id)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50">ยืนยันคะแนน</button>}</td></tr>)}</tbody></table></div>}
    </section>)}
  </div></main>;
}
