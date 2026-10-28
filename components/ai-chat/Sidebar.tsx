"use client";

import { useRouter } from "next/navigation";
import { ChatSession } from "@/lib/ai-api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

interface Props {
  sessions: ChatSession[];
  activeSessionId?: string;
  onNewSession: () => void;
}

export function Sidebar({ sessions, activeSessionId, onNewSession }: Props) {
  const router = useRouter();
  const [visibleSessions, setVisibleSessions] = useState(sessions);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => setVisibleSessions(sessions), [sessions]);

  async function deleteSelected() {
    if (!selected.length || !window.confirm(`ลบบทสนทนา ${selected.length} รายการและข้อความทั้งหมดหรือไม่?`)) return;
    const response = await fetch("/api/ai/chat/sessions", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selected }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "ลบบทสนทนาไม่สำเร็จ"); return; }
    setVisibleSessions((current) => current.filter((session) => !selected.includes(session.id)));
    if (activeSessionId && selected.includes(activeSessionId)) router.push("/dashboard/ai/chat");
    setSelected([]);
  }

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="space-y-2 p-3">
        <Link href="/" className="block w-full rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100">← หน้าแรก · งานของครู</Link>
        <button onClick={() => router.push("/dashboard/ai")} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">← ผู้ช่วย AI</button>
        <button
          onClick={onNewSession}
          className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          + สนทนาใหม่
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {selected.length > 0 && <button onClick={() => void deleteSelected()} className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-2 text-xs text-red-700"><Trash2 className="h-3.5 w-3.5"/>ลบที่เลือก ({selected.length})</button>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        {visibleSessions.map((s) => (
          <div key={s.id} className={`flex items-center gap-1 rounded-lg ${s.id === activeSessionId ? "bg-brand-50" : "hover:bg-slate-100"}`}>
            <input type="checkbox" checked={selected.includes(s.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, s.id] : current.filter((id) => id !== s.id))} aria-label={`เลือกบทสนทนา ${s.title} เพื่อลบ`} />
            <button onClick={() => router.push(`/dashboard/ai/chat/${s.id}`)} className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-sm transition ${s.id === activeSessionId ? "text-brand-700" : "text-slate-600"}`}>{s.title}</button>
          </div>
        ))}
      </div>
    </aside>
  );
}
