"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { defaultTeacherAiProfile, getTeacherAiProfileStorageKey, sanitizeTeacherAiProfile, type TeacherAiProfile } from "@/lib/teacher-ai-profile";
import { TeacherAvatar } from "./TeacherAvatar";

const earth = "min-h-screen bg-[#f3f1e9] px-4 py-6 text-[#2d342e] sm:px-8 sm:py-10";
const field = "mt-1 w-full rounded-xl border border-[#ddd7c9] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#81927e] focus:ring-2 focus:ring-[#dce5dc]";

export function TeacherAiProfileEditor() {
  const [profile, setProfile] = useState<TeacherAiProfile>(defaultTeacherAiProfile);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      void getTeacherAiProfileStorageKey().then((key) => {
        setStorageKey(key);
        const stored = localStorage.getItem(key);
        if (stored) setProfile(sanitizeTeacherAiProfile(JSON.parse(stored)));
      });
    } catch { /* Use the default profile when local settings are unavailable. */ }
  }, []);

  function save() {
    const safeProfile = sanitizeTeacherAiProfile(profile);
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(safeProfile));
    setProfile(safeProfile);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return <main className={earth}>
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/ai/chat" className="inline-flex items-center gap-2 text-sm text-[#617064] hover:text-[#35483a]"><ArrowLeft className="h-4 w-4" />กลับไปแชท AI</Link>
      <header className="mt-5 flex flex-col gap-5 rounded-3xl border border-[#e2ddcf] bg-[#fffefa] p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
        <TeacherAvatar profile={profile} size={112} />
        <div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf2ec] px-3 py-1 text-xs font-medium text-[#546d59]"><Sparkles className="h-3.5 w-3.5" />ผู้ช่วยในแบบของคุณ</span><h1 className="mt-3 text-2xl font-semibold">แต่งตัวละคร AI</h1><p className="mt-1 text-sm leading-6 text-[#6b706a]">ตั้งชื่อ เลือกการนำเสนอ และสไตล์การแต่งตัวให้ผู้ช่วยประจำห้องของคุณ</p></div>
      </header>
      <section className="mt-5 grid gap-5 rounded-3xl border border-[#e2ddcf] bg-[#fffefa] p-5 shadow-sm sm:grid-cols-2 sm:p-7">
        <label className="text-sm font-medium">ชื่อที่อยากให้ AI ใช้<input className={field} maxLength={32} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="เช่น น้องใบชา" /></label>
        <div className="text-sm font-medium">เพศ / ลักษณะการนำเสนอ<select className={field} value={["ไม่ระบุเพศ", "ผู้หญิง", "ผู้ชาย", "นอนไบนารี"].includes(profile.gender) ? profile.gender : "กำหนดเอง"} onChange={(e) => setProfile({ ...profile, gender: e.target.value === "กำหนดเอง" ? "" : e.target.value })}><option>ไม่ระบุเพศ</option><option>ผู้หญิง</option><option>ผู้ชาย</option><option>นอนไบนารี</option><option value="กำหนดเอง">กำหนดเอง</option></select></div>
        {!(["ไม่ระบุเพศ", "ผู้หญิง", "ผู้ชาย", "นอนไบนารี"].includes(profile.gender)) && <label className="text-sm font-medium sm:col-span-2">ระบุเพศหรือลักษณะที่ต้องการ<input className={field} maxLength={48} value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })} placeholder="พิมพ์คำอธิบายที่คุณต้องการ" /></label>}
        <label className="text-sm font-medium sm:col-span-2">สไตล์การแต่งตัว<select className={field} value={profile.outfit} onChange={(e) => setProfile({ ...profile, outfit: e.target.value })}><option>เอิร์ทโทน</option><option>ครูสบายๆ</option><option>เสื้อกาวน์</option><option>ชุดสร้างสรรค์</option><option>ชุดไทยร่วมสมัย</option></select></label>
        <label className="text-sm font-medium sm:col-span-2">คำแนะนำให้ AI ช่วยตอบในแบบที่ชอบ<textarea className={field} rows={4} maxLength={1200} value={profile.instructions} onChange={(e) => setProfile({ ...profile, instructions: e.target.value })} placeholder="เช่น ตอบเป็นข้อ ๆ และยกตัวอย่างกิจกรรมที่ทำได้ในห้องเรียน" /><span className="mt-1 block text-xs font-normal text-[#85877f]">คำแนะนำนี้จะถูกส่งไป Google Gemini ทุกครั้งที่ครูส่งข้อความ เพื่อปรับรูปแบบคำตอบ</span></label>
        <div className="rounded-2xl bg-[#f5f2e9] p-4 text-sm leading-6 text-[#687067] sm:col-span-2">ตัวละครแยกตามบัญชีครูบนเบราว์เซอร์นี้ การตั้งคำแนะนำช่วยปรับสไตล์คำตอบ ไม่ได้ฝึกโมเดล Gemini ให้มีความรู้ใหม่โดยตรง</div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button onClick={save} disabled={!storageKey} className="inline-flex items-center gap-2 rounded-xl bg-[#425a49] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#344a3b] disabled:opacity-50"><Save className="h-4 w-4" />บันทึกตัวละคร</button>{saved && <span role="status" className="text-sm text-[#4f7356]">บันทึกแล้วสำหรับบัญชีนี้บนเบราว์เซอร์นี้</span>}</div>
      </section>
    </div>
  </main>;
}
