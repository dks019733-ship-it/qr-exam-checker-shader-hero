"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { ChatSession } from "@/lib/ai-api";
import { defaultTeacherAiProfile, getTeacherAiProfileStorageKey, sanitizeTeacherAiProfile, type TeacherAiProfile } from "@/lib/teacher-ai-profile";
import { TeacherAvatar } from "./TeacherAvatar";

interface Props {
  sessions: ChatSession[];
  activeSessionId?: string;
  onNewSession: () => void;
}

export function Sidebar({ sessions, activeSessionId, onNewSession }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<TeacherAiProfile>(defaultTeacherAiProfile);
  useEffect(() => {
    try { void getTeacherAiProfileStorageKey().then((key) => { const stored = localStorage.getItem(key); if (stored) setProfile(sanitizeTeacherAiProfile(JSON.parse(stored))); }); }
    catch { /* Use the default profile. */ }
  }, []);

  return (
    <>
    <button onClick={() => setOpen(true)} aria-label="เปิดเมนูแชท" className="fixed left-3 top-3 z-40 inline-flex items-center gap-2 rounded-xl border border-[#ded8ca] bg-[#fffefa] px-3 py-2 text-sm text-[#435447] shadow-sm md:hidden"><Menu className="h-4 w-4" />ห้องแชท</button>
    {open && <button aria-label="ปิดเมนู" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-[#252c27]/30 md:hidden" />}
    <aside className={`${open ? "fixed inset-y-0 left-0 z-50 flex" : "hidden md:flex"} w-[min(19rem,86vw)] shrink-0 flex-col border-r border-[#e4dfd3] bg-[#fbfaf6] md:static md:w-72`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#34483a]"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e7eee6]"><Sparkles className="h-4 w-4" /></span>ผู้ช่วย AI</div>
        <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#74776f] hover:bg-[#f0eee7] md:hidden" aria-label="ปิดเมนู"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-3 pb-3">
        <button onClick={() => { router.push("/dashboard/ai"); setOpen(false); }} className="mb-2 w-full rounded-xl px-3 py-2 text-left text-sm text-[#69736a] hover:bg-[#f0eee7]">← หน้า AI</button>
        <button
          onClick={() => { void onNewSession(); setOpen(false); }}
          className="w-full rounded-xl bg-[#425a49] py-2.5 text-sm font-medium text-white transition hover:bg-[#344a3b]"
        >
          ＋ สนทนาใหม่
        </button>
      </div>

      <button onClick={() => { router.push("/dashboard/ai/profile"); setOpen(false); }} className="mx-3 mb-4 flex items-center gap-3 rounded-2xl border border-[#e4dfd3] bg-[#f4f1e9] p-3 text-left transition hover:border-[#cbd5c9]">
        <TeacherAvatar profile={profile} size={48} />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#3e4c41]">{profile.name}</span><span className="mt-0.5 block text-xs text-[#788076]">แต่งตัวละคร AI</span></span>
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#96958c]">ประวัติสนทนา</p>
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => { router.push(`/dashboard/ai/chat/${s.id}`); setOpen(false); }}
            className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
              s.id === activeSessionId ? "bg-[#e8eee7] text-[#405a46]" : "text-[#657067] hover:bg-[#f0eee7]"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="border-t border-[#e7e2d7] px-4 py-3"><button onClick={() => router.push("/dashboard")} className="text-xs text-[#85877f] hover:text-[#405a46]">← กลับหน้าหลัก</button></div>
    </aside>
    </>
  );
}
