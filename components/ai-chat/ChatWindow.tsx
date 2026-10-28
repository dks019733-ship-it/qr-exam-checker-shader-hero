"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/ai-api";
import type { TeacherAiProfile } from "@/lib/teacher-ai-profile";
import { MessageBubble } from "./MessageBubble";
import { TeacherAvatar } from "./TeacherAvatar";

interface Props {
  messages: ChatMessage[];
  isReplying: boolean;
  profile: TeacherAiProfile;
}

export function ChatWindow({ messages, isReplying, profile }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isReplying]);

  if (messages.length === 0 && !isReplying) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-10 text-center">
        <div className="max-w-sm rounded-[2rem] border border-[#e4dfd3] bg-[#fffefa] p-7 shadow-sm">
          <div className="flex justify-center"><TeacherAvatar profile={profile} size={116} /></div>
          <p className="mt-4 text-lg font-semibold text-[#39483c]">สวัสดีคุณครู</p>
          <p className="mt-1 text-sm leading-6 text-[#6e756c]">{profile.name} พร้อมช่วยคิด วางแผน และสร้างสื่อการสอนให้ครู</p>
          <p className="mt-4 rounded-xl bg-[#f3f1e9] px-3 py-2 text-xs text-[#7e8178]">เริ่มพิมพ์คำถามด้านล่างได้เลย</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-8">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} profile={profile} />
      ))}

      {isReplying && (
        <div className="flex justify-start">
          <div className="ml-11 rounded-2xl border border-[#e7e1d5] bg-[#fffefa] px-4 py-3 text-sm text-[#898b83] shadow-sm">
            กำลังพิมพ์...
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
