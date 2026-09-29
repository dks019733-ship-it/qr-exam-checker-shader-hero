"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerSheetPreview } from "@/components/answer-sheet-editor";

type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };
type Template = { schoolName: string; logoDataUrl: string | null; examTitle: string; subject: string; questionCount: number; classLabel: string };

const fallbackTemplate: Template = { schoolName: "โรงเรียนตัวอย่างวิทยา", logoDataUrl: "/school-logo-reference.png", examTitle: "แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน", subject: "", questionCount: 40, classLabel: "" };

export function PrintClassSheets() {
  const classId = useSearchParams().get("classId") ?? "";
  const [template, setTemplate] = useState<Template>(fallbackTemplate);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!classId) { setError("ไม่พบห้องเรียนที่เลือก กรุณากลับไปเลือกห้องเรียนก่อน"); setLoading(false); return; }
    Promise.all([
      fetch("/api/answer-sheet/template").then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/students?classId=${encodeURIComponent(classId)}`).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([saved, rows]: [Partial<Template> | null, Student[]]) => {
        if (saved) setTemplate({ ...fallbackTemplate, ...saved, subject: saved.subject ?? "" });
        if (!rows.length) setError("ห้องเรียนนี้ยังไม่มีนักเรียน");
        setStudents(rows);
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [classId]);

  const questions = Array.from({ length: template.questionCount }, (_, i) => i + 1);

  if (loading) return <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />กำลังเตรียมกระดาษคำตอบ...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-sm text-red-700">{error}</div>;

  return (
    <div className="bg-[#f6f7f9] print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 shadow-sm print:hidden">
        <div className="text-sm text-muted-foreground">พร้อมพิมพ์ {students.length} แผ่น (แต่ละคนมี QR ประจำตัวของตัวเอง) — ใช้ &quot;บันทึกเป็น PDF&quot; ในกล่องพิมพ์ของเบราว์เซอร์เพื่อได้ไฟล์ PDF</div>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />พิมพ์ / บันทึกเป็น PDF</Button>
      </div>
      <div className="py-6">
        {students.map((s, i) => (
          <div key={s.id} className="overflow-x-auto" style={i < students.length - 1 ? { breakAfter: "page" } : undefined}>
            <AnswerSheetPreview
              template={template}
              student={{ rollNo: s.rollNo, studentNo: s.studentNo, name: s.name }}
              questions={questions}
              qrUrl={`/api/students/${s.id}/qr`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
