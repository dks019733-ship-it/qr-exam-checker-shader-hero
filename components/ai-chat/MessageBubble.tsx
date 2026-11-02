import { ChatMessage } from "@/lib/ai-api";
import type { TeacherAiProfile } from "@/lib/teacher-ai-profile";
import { TeacherAvatar } from "./TeacherAvatar";

export function MessageBubble({ message, profile }: { message: ChatMessage; profile: TeacherAiProfile }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <TeacherAvatar profile={profile} size={34} />}
      <div className={`max-w-[min(82%,42rem)] sm:max-w-[75%] ${isUser ? "text-right" : "text-left"}`}>
        <p className="mb-1 px-1 text-[11px] font-medium text-[#87897f]">{isUser ? "คุณครู" : profile.name}</p>
        <div className={`whitespace-pre-wrap rounded-[1.25rem] px-4 py-3 text-sm leading-7 shadow-sm ${isUser ? "rounded-br-md bg-[#596f5d] text-white" : "rounded-bl-md border border-[#e7e1d5] bg-[#fffefa] text-[#343c35]"}`}>
          {message.content}
        </div>
        {message.image && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-[#e7e1d5] bg-white p-2 shadow-sm">
            <img src={`data:${message.image.mimeType};base64,${message.image.data}`} alt="ภาพประกอบใบงานที่สร้างด้วย Gemini" className="max-h-[32rem] w-full rounded-xl object-contain" />
            <a href={`data:${message.image.mimeType};base64,${message.image.data}`} download={`worksheet-illustration.${message.image.mimeType === "image/jpeg" ? "jpg" : message.image.mimeType === "image/webp" ? "webp" : "png"}`} className="mt-2 inline-flex rounded-lg bg-[#f2f1e9] px-3 py-2 text-xs font-medium text-[#465548] hover:bg-[#e8e8dd]">
              ดาวน์โหลดภาพ
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
