"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/ai-api";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  isReplying: boolean;
}

export function ChatWindow({ messages, isReplying }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isReplying]);

  if (messages.length === 0 && !isReplying) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        เริ่มพิมพ์ข้อความเพื่อสนทนากับ AI
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {isReplying && (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400">
            กำลังพิมพ์...
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
