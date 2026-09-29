"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chatApi, ChatSession } from "@/lib/ai-api";
import { Sidebar } from "@/components/ai-chat/Sidebar";

export default function ChatIndexPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    chatApi.listSessions().then((res) => setSessions(res.sessions));
  }, []);

  async function handleNewSession() {
    const { session } = await chatApi.createSession();
    router.push(`/dashboard/ai/chat/${session.id}`);
  }

  return (
    <div className="flex h-screen">
      <Sidebar sessions={sessions} onNewSession={handleNewSession} />
      <main className="flex flex-1 flex-col items-center justify-center text-slate-400">
        <p className="mb-4 text-sm">เลือกห้องสนทนา หรือเริ่มห้องใหม่</p>
        <button
          onClick={handleNewSession}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + สนทนาใหม่
        </button>
      </main>
    </div>
  );
}
