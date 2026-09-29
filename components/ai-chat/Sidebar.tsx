"use client";

import { useRouter } from "next/navigation";
import { ChatSession } from "@/lib/ai-api";

interface Props {
  sessions: ChatSession[];
  activeSessionId?: string;
  onNewSession: () => void;
}

export function Sidebar({ sessions, activeSessionId, onNewSession }: Props) {
  const router = useRouter();

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="space-y-2 p-3">
        <button onClick={() => router.push("/dashboard/ai")} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">← ผู้ช่วย AI</button>
        <button
          onClick={onNewSession}
          className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          + สนทนาใหม่
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/dashboard/ai/chat/${s.id}`)}
            className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
              s.id === activeSessionId ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
