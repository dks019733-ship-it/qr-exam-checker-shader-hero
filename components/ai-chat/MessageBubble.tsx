import { ChatMessage } from "@/lib/ai-api";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser ? "bg-brand-500 text-white" : "bg-white text-slate-800 border border-slate-200"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
