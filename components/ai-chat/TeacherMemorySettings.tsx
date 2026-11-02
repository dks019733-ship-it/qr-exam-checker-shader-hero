"use client";

import { useEffect, useState } from "react";
import { Brain, Trash2 } from "lucide-react";

type MemoryState = { enabled: boolean; preferences: string[] };

export function TeacherMemorySettings() {
  const [memory, setMemory] = useState<MemoryState>({ enabled: true, preferences: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ai/chat/memory", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดการตั้งค่าความจำไม่สำเร็จ");
        setMemory(await response.json());
      })
      .catch(() => setError("โหลดการตั้งค่าความจำไม่สำเร็จ"));
  }, []);

  async function toggle(enabled: boolean) {
    setError("");
    try {
      const response = await fetch("/api/ai/chat/memory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกการตั้งค่าไม่สำเร็จ");
      setMemory(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกการตั้งค่าไม่สำเร็จ"); }
  }

  async function clearMemory() {
    setError("");
    try {
      const response = await fetch("/api/ai/chat/memory", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ลบความจำไม่สำเร็จ");
      setMemory(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ลบความจำไม่สำเร็จ"); }
  }

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-[#e1dbcf] bg-[#fffefa] px-3 py-2 text-xs font-medium text-[#59675c] hover:bg-[#f4f1e9]">
        <Brain aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">ความจำส่วนตัว</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-[#e1dbcf] bg-[#fffefa] p-4 text-left shadow-xl">
        <h2 className="text-sm font-semibold text-[#39483c]">ความจำของคุณครู</h2>
        <p className="mt-1 text-xs leading-5 text-[#74796f]">จดจำเฉพาะความชอบรูปแบบการตอบที่ตรวจพบจากข้อความ เช่น ตอบสั้นหรือใช้ตัวอย่าง เพื่อปรับคำตอบครั้งถัดไป ไม่ได้นำไปฝึกโมเดลร่วมกัน</p>
        <label className="mt-3 flex items-center gap-2 text-xs text-[#505b51]">
          <input type="checkbox" checked={memory.enabled} onChange={(event) => void toggle(event.target.checked)} className="accent-[#526d57]" />
          เปิดการเรียนรู้ความชอบส่วนตัว
        </label>
        <p className="mt-3 text-xs font-medium text-[#59675c]">สิ่งที่จำไว้</p>
        {memory.preferences.length ? <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-[#74796f]">{memory.preferences.map((preference) => <li key={preference}>{preference}</li>)}</ul> : <p className="mt-1 text-xs text-[#898c83]">ยังไม่มีความชอบที่บันทึก</p>}
        <button type="button" onClick={() => void clearMemory()} disabled={!memory.preferences.length} className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40">
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />ล้างความจำ
        </button>
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </details>
  );
}
