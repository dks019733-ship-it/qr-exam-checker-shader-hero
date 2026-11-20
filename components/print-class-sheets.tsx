"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerSheetPreview } from "@/components/answer-sheet-editor";
import { downloadAnswerSheetsPdf } from "@/lib/answer-sheet-pdf";

type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };
type Template = { schoolName: string; logoDataUrl: string | null; examTitle: string; subject: string; subjectCode: string; questionCount: number; choiceCount: number; choiceLabelStyle: string; classLabel: string };

const fallbackTemplate: Template = { schoolName: "โรงเรียนตัวอย่างวิทยา", logoDataUrl: "/school-logo-reference.png", examTitle: "แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน", subject: "", subjectCode: "", questionCount: 40, choiceCount: 4, choiceLabelStyle: "LATIN", classLabel: "" };

export function PrintClassSheets() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId") ?? "";
  const plainMode = searchParams.get("mode") === "plain";
  const [template, setTemplate] = useState<Template>(fallbackTemplate);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const sheetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!classId) { setError("ไม่พบห้องเรียนที่เลือก กรุณากลับไปเลือกห้องเรียนก่อน"); setLoading(false); return; }
    Promise.all([
      fetch("/api/answer-sheet/template").then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/students?classId=${encodeURIComponent(classId)}`).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([saved, rows]: [Partial<Template> | null, Student[]]) => {
        if (saved) setTemplate({ ...fallbackTemplate, ...saved, subject: saved.subject ?? "", subjectCode: saved.subjectCode ?? "" });
        if (!rows.length) setError("ห้องเรียนนี้ยังไม่มีนักเรียน");
        setStudents(rows);
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [classId]);

  const questions = Array.from({ length: template.questionCount }, (_, i) => i + 1);

  async function downloadAllSheets() {
    const elements = Array.from(sheetsRef.current?.querySelectorAll<HTMLElement>(".omr-answer-sheet") ?? []);
    if (!elements.length) { setDownloadMessage("ไม่พบกระดาษคำตอบสำหรับสร้าง PDF"); return; }
    setExporting(true);
    setDownloadMessage("");
    try {
      const className = (template.classLabel || "class").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "class";
      await downloadAnswerSheetsPdf(elements, `answer-sheets-${className}-${plainMode ? "plain" : "qr"}.pdf`);
      setDownloadMessage(`ดาวน์โหลด PDF สำเร็จ ${elements.length} หน้า`);
    } catch (cause) {
      setDownloadMessage(cause instanceof Error ? cause.message : "สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่");
    } finally { setExporting(false); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />กำลังเตรียมกระดาษคำตอบ...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-sm text-red-700">{error}</div>;

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4 shadow-sm">
        <div className="text-sm text-muted-foreground">พร้อมดาวน์โหลด {students.length} แผ่น ({plainMode ? "แบบธรรมดา ไม่มี QR" : "แบบ QR ประจำตัวนักเรียน"})</div>
        <Button onClick={downloadAllSheets} disabled={exporting}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{exporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF ทั้งห้อง"}</Button>
      </div>
      {downloadMessage && <p role="status" className="mx-auto max-w-5xl px-4 pt-4 text-sm text-muted-foreground">{downloadMessage}</p>}
      <div ref={sheetsRef} className="space-y-6 py-6">
        {students.map((s) => (
          <div key={s.id}>
            <AnswerSheetPreview
              template={template}
              student={{ rollNo: s.rollNo, studentNo: s.studentNo, name: s.name }}
              questions={questions}
              qrUrl={plainMode ? undefined : `/api/students/${s.id}/qr?v=2`}
              showQr={!plainMode}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
