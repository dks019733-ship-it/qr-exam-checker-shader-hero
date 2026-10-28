"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, UserRound } from "lucide-react";
import { chatApi, ChatMessage, ChatSession } from "@/lib/ai-api";
import { defaultTeacherAiProfile, getTeacherAiProfileStorageKey, sanitizeTeacherAiProfile, type TeacherAiProfile } from "@/lib/teacher-ai-profile";
import { Sidebar } from "@/components/ai-chat/Sidebar";
import { ChatWindow } from "@/components/ai-chat/ChatWindow";
import { ChatInput } from "@/components/ai-chat/ChatInput";
import { TeacherAvatar } from "@/components/ai-chat/TeacherAvatar";

export default function ChatSessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TeacherAiProfile>(defaultTeacherAiProfile);

  useEffect(() => {
    try { void getTeacherAiProfileStorageKey().then((key) => { const stored = localStorage.getItem(key); if (stored) setProfile(sanitizeTeacherAiProfile(JSON.parse(stored))); }); }
    catch { /* Use the default profile. */ }
  }, []);

  useEffect(() => {
    chatApi.listSessions().then((res) => setSessions(res.sessions));
  }, [sessionId]);

  useEffect(() => {
    setMessages([]);
    chatApi
      .listMessages(sessionId)
      .then((res) => setMessages(res.messages))
      .catch(() => setError("ไม่พบห้องสนทนานี้ หรือไม่มีสิทธิ์เข้าถึง"));
  }, [sessionId]);

  async function handleNewSession() {
    const { session } = await chatApi.createSession();
    router.push(`/dashboard/ai/chat/${session.id}`);
  }

  async function handleSend(content: string) {
    setError(null);

    // แสดงข้อความของครูทันที (optimistic update)
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setIsReplying(true);

    try {
      const { reply } = await chatApi.sendMessage(sessionId, content, profile);
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      setError(err.message || "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f3f1e9] text-[#303832]">
      <Sidebar sessions={sessions} activeSessionId={sessionId} onNewSession={handleNewSession} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#e4dfd3] bg-[#fbfaf6] px-3 pl-28 sm:px-6 sm:pl-28 md:pl-6">
          <div className="flex min-w-0 items-center gap-3"><span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-[#e7eee6] text-[#526d57] sm:flex"><Sparkles className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#39483c]">แชทกับ {profile.name}</p><p className="hidden text-xs text-[#85877f] sm:block">ผู้ช่วย AI สำหรับครู · ตรวจทานคำตอบก่อนนำไปใช้</p></div></div>
          <Link href="/dashboard/ai/profile" className="flex shrink-0 items-center gap-2 rounded-xl border border-[#e1dbcf] bg-[#fffefa] py-1.5 pl-1.5 pr-3 text-xs font-medium text-[#59675c] hover:bg-[#f4f1e9]"><TeacherAvatar profile={profile} size={32} /><span className="hidden sm:inline">ตั้งค่าตัวละคร</span><UserRound className="h-3.5 w-3.5 sm:hidden" /></Link>
        </header>
        <ChatWindow messages={messages} isReplying={isReplying} profile={profile} />

        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <ChatInput onSend={handleSend} disabled={isReplying} />
      </main>
    </div>
  );
}
