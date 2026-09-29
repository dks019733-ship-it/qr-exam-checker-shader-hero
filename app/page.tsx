import ShaderHero from "@/components/ui/shader-hero";
import { Cloud, FileCheck2, ScanLine, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/auth-buttons";
import Link from "next/link";
import { HeroActions, HeroLogin, HeroNavigation } from "@/components/ui/hero-links";

const features = [
  ["Scan & Check", "สแกน QR และอ่านใบคำตอบ โดยส่งข้อที่ไม่ชัดให้ครูตรวจ", ScanLine],
  ["Google Drive", "ไฟล์ของครูแต่ละคนเก็บใน Drive ของบัญชีที่เชื่อมต่อ", Cloud],
  ["Review First", "ตรวจทานเฉลยและคะแนนก่อนยืนยันผลทุกครั้ง", FileCheck2],
  ["Private by design", "แยกข้อมูลตามบัญชีและตรวจสิทธิ์ที่ฝั่ง Server", ShieldCheck],
  ["AI สำหรับครู", "แชท สร้างข้อสอบ และทำเอกสารเป็นร่างให้ครูตรวจทานก่อนใช้", Sparkles]
] as const;

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="min-h-screen bg-background">
      <section id="overview" className="w-full p-2 sm:p-3">
        <ShaderHero
          navigation={<HeroNavigation signedIn={Boolean(session?.user)} />}
          login={<HeroLogin signedIn={Boolean(session?.user)} />}
          actions={<HeroActions signedIn={Boolean(session?.user)} />}
        />
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">QR EXAM CHECKER</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">ตรวจข้อสอบให้เป็นระบบ ตั้งแต่ QR ถึงรายงาน</h2>
          <p className="mt-4 text-muted-foreground">จัดการข้อสอบ นักเรียน และใบคำตอบ พร้อมผู้ช่วย AI สำหรับแชทและสร้างเอกสารในระบบเดียว</p>
          <div className="mt-6">
            {session?.user ? (
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                ไปที่แดชบอร์ด<ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <SignInButton redirectTo="/dashboard/ai/chat" />
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, text, Icon]) => (
            <article key={title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <Icon className="mb-8 h-5 w-5" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              {title === "AI สำหรับครู" && (session?.user ? (
                <Link href="/dashboard/ai/chat" className="mt-4 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800">เปิดแชท AI</Link>
              ) : (
                <SignInButton redirectTo="/dashboard/ai/chat" className="mt-4 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800" />
              ))}
            </article>
          ))}
        </div>
      </section>
      <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">QR Exam Checker · Secure exam workflow</footer>
    </main>
  );
}
