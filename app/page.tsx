import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Cloud,
  FileCheck2,
  GraduationCap,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { SystemGuardianPanel } from "@/components/system-guardian-panel";
import { SiteAnnouncementBanner } from "@/components/site-announcement-banner";
import { isSystemOwner } from "@/lib/system-guardian";

const tools = [
  {
    title: "จัดการห้องเรียนและนักเรียน",
    description: "สร้างห้องเรียน นำเข้ารายชื่อ และจัดการข้อมูลนักเรียนในที่เดียว",
    href: "/dashboard/classes",
    icon: Users,
  },
  {
    title: "รายวิชาที่ฉันสอน",
    description: "เพิ่มหลายรหัสวิชาและกำหนดห้องเรียนที่รับผิดชอบแยกตามรายวิชา",
    href: "/dashboard/subjects",
    icon: BookOpen,
  },
  {
    title: "สร้างและจัดการข้อสอบ",
    description: "กำหนดข้อสอบและเฉลย เพื่อเตรียมตรวจและสรุปผลคะแนน",
    href: "/dashboard/exams",
    icon: ClipboardList,
  },
  {
    title: "ตรวจข้อสอบด้วย QR",
    description: "บันทึกคำตอบ คำนวณคะแนน และตรวจทานผลก่อนยืนยัน",
    href: "/dashboard/scan",
    icon: ScanLine,
  },
  {
    title: "กระดาษคำตอบ",
    description: "ตั้งค่าข้อมูลข้อสอบ สร้าง QR และพิมพ์กระดาษคำตอบ",
    href: "/dashboard/answer-sheet",
    icon: FileCheck2,
  },
  {
    title: "รายงานคะแนน",
    description: "ดูผลสอบ ยืนยันคะแนน และส่งออกข้อมูลสำหรับชั้นเรียน",
    href: "/dashboard/reports",
    icon: BarChart3,
  },
  {
    title: "สมุดคะแนนออนไลน์",
    description: "รวมคะแนนงานและข้อสอบ พร้อมจัดการคะแนนของแต่ละห้องเรียน",
    href: "/dashboard/gradebook",
    icon: BookOpen,
  },
  {
    title: "ผู้ช่วย AI สำหรับครู",
    description: "แชท สร้างข้อสอบ หรือร่างเอกสารการสอนให้ครูตรวจทาน",
    href: "/dashboard/ai",
    icon: Sparkles,
    highlight: true,
  },
  {
    title: "AI สร้าง Google Forms",
    description: "ให้ AI ช่วยร่างข้อสอบ แล้วครูตรวจทานก่อนสร้างแบบฟอร์ม",
    href: "/dashboard/ai/materials?kind=exam",
    icon: ClipboardList,
    highlight: true,
  },
] as const;

const workflow = [
  {
    title: "สร้างกระดาษคำตอบ",
    description: "เลือกห้องเรียนและข้อสอบ แล้วสร้างใบคำตอบพร้อม QR สำหรับนักเรียน",
    icon: FileCheck2,
  },
  {
    title: "สแกนและตรวจทาน",
    description: "บันทึกคำตอบผ่านระบบตรวจข้อสอบ และตรวจสอบรายการที่ต้องยืนยัน",
    icon: ScanLine,
  },
  {
    title: "ดูผลและจัดการคะแนน",
    description: "ติดตามคะแนนในรายงานและสมุดคะแนน พร้อมจัดการข้อมูลต่อได้",
    icon: BarChart3,
  },
] as const;

function WorkspaceLink({
  signedIn,
  href,
  className,
  children,
}: {
  signedIn: boolean;
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (!signedIn) {
    return (
      <SignInButton
        className={className}
        label={typeof children === "string" ? children : undefined}
        {...(typeof children === "string" ? {} : { children })}
      />
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const systemOwner = signedIn ? await isSystemOwner() : false;

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#1c241b]">
      <SiteAnnouncementBanner />

      <div className="sticky top-12 z-40 px-3 pt-3 sm:px-6">
        <header className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 rounded-2xl border border-[#e5ebd0]/80 bg-white/95 px-4 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="งานของครู หน้าแรก">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4d5f4a] to-[#374535] text-[#d8e6d5] shadow-md shadow-[#4d5f4a]/20 transition group-hover:scale-[1.03]">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden sm:flex sm:flex-col">
              <span className="text-sm font-extrabold tracking-tight text-[#1c241b]">งานของครู</span>
              <span className="text-[10px] font-medium text-[#5e6d5b]">ngankhongkhru</span>
            </span>
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 md:flex">
            <Link href="#overview" className="rounded-lg px-3 py-2 text-xs font-semibold text-[#4d5f4a] transition hover:bg-[#f0f3eb]">หน้าแรก</Link>
            <Link href="#workflow" className="rounded-lg px-3 py-2 text-xs font-semibold text-[#5e6d5b] transition hover:bg-[#f0f3eb] hover:text-[#1c241b]">วิธีใช้งาน</Link>
            <Link href="#tools" className="rounded-lg px-3 py-2 text-xs font-semibold text-[#5e6d5b] transition hover:bg-[#f0f3eb] hover:text-[#1c241b]">เครื่องมือ</Link>
            <Link href="/student" className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 transition hover:bg-emerald-100">สำหรับนักเรียน (เช็กงาน)</Link>
            <Link href="#privacy" className="rounded-lg px-3 py-2 text-xs font-semibold text-[#5e6d5b] transition hover:bg-[#f0f3eb] hover:text-[#1c241b]">ความเป็นส่วนตัว</Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <WorkspaceLink
              signedIn={signedIn}
              href="#tools"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#4d5f4a] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#374535] sm:px-5"
            >
              {signedIn ? "ดูเครื่องมือ" : "เข้าสู่ระบบ"}
            </WorkspaceLink>
            {signedIn && <SignOutButton />}
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-7xl space-y-20 px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {systemOwner && <SystemGuardianPanel />}
        <section
          id="overview"
          aria-labelledby="hero-title"
          className="relative isolate scroll-mt-28 overflow-hidden rounded-[2rem] border border-[#a3bfa0]/30 bg-gradient-to-br from-white via-[#f9faf7] to-[#e8efe7] p-6 shadow-xl shadow-[#4d5f4a]/5 sm:rounded-[2.5rem] sm:p-10 lg:p-14"
        >
          <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#d8e6d5]/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#a3bfa0]/25 blur-3xl" />

          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="space-y-7 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#a3bfa0]/40 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-[#4d5f4a] shadow-sm">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                พื้นที่ทำงานสำหรับคุณครู
              </div>
              <div className="space-y-3">
                <h1 id="hero-title" className="max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-[#1c241b] sm:text-5xl lg:text-6xl">
                  จัดการ{" "}
                  <span className="font-serif font-semibold italic text-[#5c7057]">งานของครู</span>
                  <span className="mt-2 block text-3xl font-light leading-tight text-[#4d5f4a] sm:text-4xl lg:text-5xl">
                    ให้ง่าย รวดเร็ว และเป็นระบบ
                  </span>
                </h1>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#5e6d5b] sm:text-base">
                จัดการห้องเรียนและข้อสอบ สร้างกระดาษคำตอบพร้อม QR ตรวจคะแนน และดูรายงานได้ในที่เดียว พร้อมผู้ช่วย AI สำหรับงานสอน
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <WorkspaceLink
                  signedIn={signedIn}
                  href={signedIn ? "#tools" : "/"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#4d5f4a] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#4d5f4a]/20 transition hover:bg-[#374535]"
                >
                  {signedIn ? "เลือกเครื่องมือที่ต้องการ" : "เริ่มใช้งาน"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </WorkspaceLink>
                <Link
                  href="#tools"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#a3bfa0] bg-white/80 px-6 py-3 text-sm font-semibold text-[#2d3a2b] transition hover:bg-[#d8e6d5]/40"
                >
                  ดูเครื่องมือทั้งหมด
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs font-medium text-[#5e6d5b]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#4d5f4a]" aria-hidden="true" />ครูตรวจทานผลได้ก่อนยืนยัน</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#4d5f4a]" aria-hidden="true" />ออกแบบโดยคำนึงถึงความเป็นส่วนตัว</span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative rounded-[1.75rem] border border-white bg-white/90 p-4 shadow-2xl shadow-[#344a3b]/10 ring-1 ring-[#a3bfa0]/30 backdrop-blur-xl sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#a3bfa0]/20 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d8e6d5] text-[#4d5f4a]">
                      <GraduationCap className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#1c241b]">ภาพรวมการตรวจข้อสอบ</p>
                      <p className="text-xs text-[#5e6d5b]">ตัวอย่างหน้าสรุปผล</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#f0f3eb] px-2.5 py-1 text-[10px] font-bold text-[#4d5f4a]">ตัวอย่าง</span>
                </div>

                <div className="rounded-2xl bg-[#2d3a2b] p-4 text-white shadow-inner">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-[#d8e6d5]" aria-hidden="true" />
                      <span className="text-xs font-medium text-[#d8e6d5]">ผลการตรวจคำตอบ</span>
                    </div>
                    <span className="rounded-full bg-[#7a9576]/40 px-2.5 py-1 text-[11px] font-bold text-[#d8e6d5]">36 / 40 คะแนน</span>
                  </div>
                  <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[90%] rounded-full bg-gradient-to-r from-[#7a9576] to-[#d8e6d5]" />
                  </div>
                  <div className="flex justify-between gap-2 text-[10px] text-[#a3bfa0]">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-[#d8e6d5]" aria-hidden="true" />รอตรวจทานก่อนยืนยัน</span>
                    <span className="font-semibold">90%</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#a3bfa0]/30 bg-[#f8f7f4] p-3.5">
                    <p className="text-xs text-[#5e6d5b]">การจัดการห้องเรียน</p>
                    <p className="mt-1 text-sm font-bold text-[#4d5f4a]">รายชื่อนักเรียน</p>
                  </div>
                  <div className="rounded-2xl border border-[#a3bfa0]/30 bg-[#f8f7f4] p-3.5">
                    <p className="text-xs text-[#5e6d5b]">เครื่องมือสำหรับครู</p>
                    <p className="mt-1 text-sm font-bold text-[#4d5f4a]">ข้อสอบและรายงาน</p>
                  </div>
                </div>

                <Link
                  href="/dashboard/scan"
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#d8e6d5] px-4 py-3 text-xs font-bold text-[#2d3a2b] transition hover:bg-[#a3bfa0]"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  ดูระบบตรวจข้อสอบ
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-28 space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5c7057]">ทำงานได้ต่อเนื่องในระบบเดียว</p>
            <h2 id="workflow-title" className="text-2xl font-extrabold tracking-tight text-[#1c241b] sm:text-3xl">
              จากกระดาษคำตอบ สู่ผลคะแนนที่พร้อมใช้งาน
            </h2>
            <p className="text-sm leading-6 text-[#5e6d5b]">
              เครื่องมือที่ช่วยลดขั้นตอนงานตรวจข้อสอบและจัดการข้อมูลห้องเรียน
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map(({ title, description, icon: Icon }, index) => (
              <article key={title} className="rounded-3xl border border-[#e0e7d9] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#7a9576]/50 hover:shadow-xl sm:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d8e6d5] text-[#4d5f4a]">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold tracking-widest text-[#7a9576]">0{index + 1}</span>
                </div>
                <h3 className="text-base font-bold text-[#1c241b]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5e6d5b]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="tools" aria-labelledby="tools-title" className="scroll-mt-28 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#5c7057]">พื้นที่ทำงานครู</p>
              <h2 id="tools-title" className="text-2xl font-extrabold tracking-tight text-[#1c241b] sm:text-3xl">เครื่องมือพร้อมใช้งาน</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e6d5b]">ทุกเครื่องมือเชื่อมกับพื้นที่ทำงานของคุณครู ลงชื่อเข้าใช้เพื่อเริ่มจัดการข้อมูล</p>
            </div>
            <span className="w-fit rounded-full border border-[#a3bfa0]/40 bg-[#eaf2e8] px-3 py-1.5 text-xs font-bold text-[#374535]">
              {tools.length} เครื่องมือ
            </span>
          </div>

          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map(({ title, description, href, icon: Icon, ...tool }) => (
              <WorkspaceLink
                key={title}
                signedIn={signedIn}
                href={href}
                className={`group flex h-full min-h-64 flex-col rounded-3xl border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c7057] focus-visible:ring-offset-2 sm:p-6 ${
                  "highlight" in tool && tool.highlight
                    ? "border-[#4d5f4a]/50 ring-1 ring-[#4d5f4a]/15 hover:border-[#4d5f4a]"
                    : "border-[#e0e7d9] hover:border-[#7a9576]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0f3eb] text-[#4d5f4a] transition group-hover:bg-[#d8e6d5]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-[#a3bfa0]/40 bg-[#eaf2e8] px-2.5 py-1 text-[10px] font-bold text-[#374535]">
                    {signedIn ? "พร้อมใช้งาน" : "เข้าสู่ระบบเพื่อเริ่ม"}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-extrabold text-[#1c241b]">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#5e6d5b]">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 border-t border-[#f0f3eb] pt-4 text-sm font-bold text-[#4d5f4a]">
                  {signedIn ? "เปิดเครื่องมือ" : "เข้าสู่ระบบ"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </WorkspaceLink>
            ))}
          </div>
        </section>

        <section id="privacy" aria-labelledby="privacy-title" className="relative scroll-mt-28 overflow-hidden rounded-[2rem] bg-[#2d3a2b] p-7 text-white sm:rounded-[2.5rem] sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-[#7a9576]/20 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7a9576]/40 bg-[#4d5f4a]/60 px-3.5 py-1.5 text-xs font-semibold text-[#d8e6d5]">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                ออกแบบโดยคำนึงถึงความเป็นส่วนตัว
              </div>
              <h2 id="privacy-title" className="text-2xl font-extrabold leading-tight text-[#d8e6d5] sm:text-3xl">
                ข้อมูลของแต่ละบัญชีแยกจากกัน และครูตรวจทานผลได้ก่อนยืนยัน
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[#c5d5c1]">
                ระบบกำหนดสิทธิ์ตรวจสอบข้อมูลที่ฝั่งเซิร์ฟเวอร์ และออกแบบขั้นตอนให้ครูตรวจทานผลก่อนบันทึกคะแนน
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs font-medium text-[#d8e6d5]">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" />แยกข้อมูลตามบัญชีผู้ใช้</span>
                <span className="inline-flex items-center gap-2"><Cloud className="h-4 w-4" aria-hidden="true" />เชื่อมต่อบริการของ Google ตามการตั้งค่าบัญชี</span>
              </div>
            </div>
            <div className="lg:col-span-4 lg:flex lg:justify-end">
              <WorkspaceLink
                signedIn={signedIn}
                href={signedIn ? "#tools" : "/"}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#d8e6d5] px-6 py-3 text-sm font-bold text-[#2d3a2b] transition hover:bg-[#a3bfa0]"
              >
                {signedIn ? "ดูเครื่องมือ" : "เข้าสู่ระบบเพื่อเริ่ม"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </WorkspaceLink>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#e0e7d9] px-4 py-8 text-center text-xs text-[#5e6d5b]">
        <p className="font-extrabold text-[#1c241b]">งานของครู · ngankhongkhru</p>
        <p className="mt-1">เครื่องมือช่วยจัดการงานสอน ห้องเรียน และข้อสอบ</p>
      </footer>
    </main>
  );
}
