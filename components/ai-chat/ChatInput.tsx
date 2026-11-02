"use client";

import { ChangeEvent, KeyboardEvent, useRef, useState } from "react";
import { FileText, Image, Paperclip, Send, X } from "lucide-react";

export type ChatMode = "chat" | "worksheet" | "image";

interface Props {
  onSend: (content: string, files: File[], mode: ChatMode) => void;
  disabled?: boolean;
}

const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv";

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ChatMode>("chat");
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    setFiles((current) => [...current, ...selected].slice(0, 4));
    event.target.value = "";
  }

  function handleSend() {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    onSend(trimmed, files, mode);
    setValue("");
    setFiles([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-[#e5dfd3] bg-[#fbfaf6] p-3 sm:px-8 sm:py-4">
      <div className="mx-auto max-w-4xl rounded-[1.65rem] border border-[#ded8ca] bg-[#fffefa] p-2 shadow-[0_4px_18px_rgba(54,63,51,0.08)] transition focus-within:border-[#98aa97] focus-within:shadow-[0_8px_28px_rgba(54,63,51,0.12)]">
        {files.length > 0 && (
          <ul aria-label="ไฟล์ที่แนบ" className="flex flex-wrap gap-2 px-2 pt-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex max-w-full items-center gap-1.5 rounded-xl bg-[#f2f1e9] px-2.5 py-1.5 text-xs text-[#536352]">
                <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-40 truncate">{file.name}</span>
                <button type="button" aria-label={`นำไฟล์ ${file.name} ออก`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="rounded-full p-0.5 hover:bg-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInput} type="file" multiple accept={ACCEPTED_FILES} onChange={addFiles} className="sr-only" aria-label="เลือกไฟล์แนบ" />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={disabled || files.length >= 4} aria-label="แนบไฟล์" title="แนบ PDF, รูปภาพ, TXT หรือ CSV (ไม่เกิน 4 ไฟล์)" className="mb-0.5 rounded-full p-3 text-[#667365] transition hover:bg-[#f1f0e9] disabled:opacity-40">
            <Paperclip aria-hidden="true" className="h-5 w-5" />
          </button>
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={2}
            placeholder="ถามเรื่องการสอน หรือแนบเอกสารให้น้องใบช่วยดู..."
            aria-label="ข้อความถึงผู้ช่วย AI"
            className="max-h-36 min-h-12 flex-1 resize-y border-0 bg-transparent px-2 py-3 text-sm leading-6 outline-none focus:ring-0 disabled:opacity-60"
          />
          <button onClick={handleSend} disabled={disabled || (!value.trim() && files.length === 0)} aria-label="ส่งข้อความ" title="ส่งข้อความ" className="mb-0.5 rounded-full bg-[#39483c] p-3 text-white transition hover:bg-[#28372d] disabled:cursor-not-allowed disabled:opacity-40">
            <Send aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efede6] px-2 pt-2">
          <label className="flex items-center gap-2 text-xs font-medium text-[#687267]">
            <span>โหมด AI</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as ChatMode)} disabled={disabled} className="rounded-full border-0 bg-[#f2f1e9] py-1.5 pl-3 pr-7 text-xs font-medium text-[#465548] outline-none focus:ring-2 focus:ring-[#98aa97]">
              <option value="chat">Gemini · แชททั่วไป</option>
              <option value="worksheet">Gemini · สร้างใบงานข้อความ</option>
              <option value="image">Gemini Nano Banana 2.1 · สร้างภาพใบงาน</option>
            </select>
          </label>
          <span className="flex items-center gap-1 text-[10px] text-[#898c83]">
            <Image aria-hidden="true" className="h-3.5 w-3.5" />
            {mode === "image" ? "แนบภาพ PNG / JPG / WebP เพื่อใช้เป็นภาพอ้างอิงได้" : "รองรับแนบ PDF / รูป / TXT / CSV"}
          </span>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-4xl text-[10px] text-[#9a9a91]">ไฟล์จะส่งให้ Gemini ใช้ตอบครั้งนี้เท่านั้น และไม่บันทึกเนื้อหาไฟล์ · AI อาจตอบผิดได้ โปรดตรวจทานก่อนนำไปใช้</p>
    </div>
  );
}
