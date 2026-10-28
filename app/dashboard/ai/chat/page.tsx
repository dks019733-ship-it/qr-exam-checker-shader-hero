"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { chatApi, ChatSession } from "@/lib/ai-api";
import { defaultTeacherAiProfile, getTeacherAiProfileStorageKey, sanitizeTeacherAiProfile, type TeacherAiProfile } from "@/lib/teacher-ai-profile";
import { Sidebar } from "@/components/ai-chat/Sidebar";
import { TeacherAvatar } from "@/components/ai-chat/TeacherAvatar";

export default function ChatIndexPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [profile, setProfile] = useState<TeacherAiProfile>(defaultTeacherAiProfile);

  useEffect(() => {
    chatApi.listSessions().then((res) => setSessions(res.sessions));
    try { void getTeacherAiProfileStorageKey().then((key) => { const stored = localStorage.getItem(key); if (stored) setProfile(sanitizeTeacherAiProfile(JSON.parse(stored))); }); }
    catch { /* Use the default profile. */ }
  }, []);

  async function handleNewSession() {
    const { session } = await chatApi.createSession();
    router.push(`/dashboard/ai/chat/${session.id}`);
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f3f1e9] text-[#303832]">
      <Sidebar sessions={sessions} onNewSession={handleNewSession} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between border-b border-[#e4dfd3] bg-[#fbfaf6] px-3 pl-28 sm:px-6 sm:pl-28 md:pl-6"><div><p className="text-sm font-semibold text-[#39483c]">พื้นที่สนทนา</p><p className="hidden text-xs text-[#85877f] sm:block">ประวัติของคุณจะอยู่ในรายการทางซ้าย</p></div><Link href="/dashboard/ai/profile" className="flex items-center gap-2 rounded-xl border border-[#e1dbcf] bg-[#fffefa] py-1.5 pl-1.5 pr-3 text-xs font-medium text-[#59675c]"><TeacherAvatar profile={profile} size={32} /><span>ปรับแต่ง AI</span></Link></header>
        <section className="flex flex-1 items-center justify-center px-5 py-8 text-center"><div className="max-w-sm rounded-[2rem] border border-[#e4dfd3] bg-[#fffefa] p-7 shadow-sm"><div className="flex justify-center"><TeacherAvatar profile={profile} size={128} /></div><span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#edf2ec] px-3 py-1 text-xs font-medium text-[#546d59]"><Sparkles className="h-3.5 w-3.5" />พร้อมช่วยคุณครู</span><h1 className="mt-3 text-xl font-semibold text-[#39483c]">สวัสดีคุณครู · {profile.name}</h1><p className="mt-2 text-sm leading-6 text-[#6e756c]">ถามเรื่องการสอน วางแผนกิจกรรม หรือให้ช่วยร่างสื่อการเรียนรู้ได้เลย</p><button onClick={handleNewSession} className="mt-5 rounded-xl bg-[#425a49] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#344a3b]">เริ่มสนทนา</button></div></section>
      </main>
    </div>
  );
}
