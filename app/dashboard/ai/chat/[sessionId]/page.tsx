"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { chatApi, ChatMessage, ChatSession } from "@/lib/ai-api";
import { Sidebar } from "@/components/ai-chat/Sidebar";
import { ChatWindow } from "@/components/ai-chat/ChatWindow";
import { ChatInput } from "@/components/ai-chat/ChatInput";

export default function ChatSessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { reply } = await chatApi.sendMessage(sessionId, content);
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      setError(err.message || "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar sessions={sessions} activeSessionId={sessionId} onNewSession={handleNewSession} />

      <main className="flex flex-1 flex-col">
        <ChatWindow messages={messages} isReplying={isReplying} />

        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <ChatInput onSend={handleSend} disabled={isReplying} />
      </main>
    </div>
  );
}
