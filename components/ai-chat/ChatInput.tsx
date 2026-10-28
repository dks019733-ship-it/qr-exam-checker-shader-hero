"use client";

import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-[#e5dfd3] bg-[#fbfaf6] p-3 sm:px-8 sm:py-4">
      <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-[#ded8ca] bg-[#fffefa] p-2 shadow-sm focus-within:border-[#98aa97]">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="พิมพ์ข้อความ... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
        className="max-h-32 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-0 disabled:opacity-60"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="rounded-xl bg-[#425a49] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#344a3b] disabled:opacity-40"
      >
        ส่ง
      </button>
      </div>
      <p className="mx-auto mt-2 max-w-4xl text-[10px] text-[#9a9a91]">AI อาจตอบผิดได้ ตรวจทานข้อมูลสำคัญก่อนนำไปใช้</p>
    </div>
  );
}
