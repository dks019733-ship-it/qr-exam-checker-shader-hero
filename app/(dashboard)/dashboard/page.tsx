import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileImage,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ScanLine,
  Sparkles,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/auth-buttons";

const tools = [
  { title: "จัดการห้องเรียนและนักเรียน", description: "สร้างห้อง นำเข้ารายชื่อ แก้ไขข้อมูล และค้นหานักเรียน", icon: Users, href: "/dashboard/classes" },
  { title: "จัดการข้อสอบ", description: "สร้างข้อสอบ เลือกห้องเรียน และกำหนดเฉลย", icon: FileText, href: "/dashboard/exams" },
  { title: "ตรวจคำตอบ", description: "บันทึกคำตอบ คำนวณคะแนน และยืนยันผลสอบ", icon: ScanLine, href: "/dashboard/scan" },
  { title: "รายงานคะแนน", description: "ดูผลสอบ ยืนยันคะแนน และดาวน์โหลดรายงาน", icon: GraduationCap, href: "/dashboard/reports" },
  { title: "สมุดคะแนนออนไลน์", description: "รวมคะแนนงานและข้อสอบ แบ่งช่วงกลางภาคและหลังกลางภาค", icon: BookOpenCheck, href: "/dashboard/gradebook" },
  { title: "กระดาษคำตอบ", description: "ตั้งค่าหัวกระดาษ เลือกห้อง และพิมพ์ใบคำตอบพร้อม QR", icon: FileImage, href: "/dashboard/answer-sheet" },
  { title: "ผู้ช่วย AI สำหรับครู", description: "เลือกแชท สร้างข้อสอบ หรือร่างเอกสารการสอน", icon: Sparkles, href: "/dashboard/ai" },
  { title: "AI สร้าง Google Forms", description: "ให้ AI ร่างข้อสอบ ตรวจทาน แล้วสร้างฟอร์มพร้อมลิงก์ให้นักเรียน", icon: ClipboardCheck, href: "/dashboard/ai/materials?kind=exam" },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="min-h-screen bg-[#f7f6f0] px-4 py-5 text-[#1a2119] sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7 sm:space-y-8">
        <header className="relative flex flex-col gap-6 overflow-hidden rounded-[2rem] border border-[#e2e6de] bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gradient-to-bl from-[#d1edd3]/50 to-transparent blur-2xl" />
          <div className="relative z-10">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#5c7057] hover:text-[#4b5c47]">
              <LayoutDashboard className="h-4 w-4" />
              พื้นที่ทำงานครู · Workspace
            </Link>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-[#1a2119] sm:text-3xl">
              สวัสดี{session.user.name ? " " + session.user.name : "คุณครู"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#62705e]">
              จัดการห้องเรียน ข้อสอบ และเอกสารการสอนได้ในที่เดียว เลือกเครื่องมือที่ต้องการเริ่มใช้งาน
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-3">
            <Link href="/dashboard/answer-sheet" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4b5c47] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3d4c3a]">
              สร้างกระดาษคำตอบ <ArrowRight className="h-4 w-4" />
            </Link>
            <SignOutButton />
          </div>
        </header>

        <section aria-labelledby="dashboard-tools-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="dashboard-tools-title" className="text-lg font-extrabold tracking-tight text-[#1a2119] sm:text-xl">
                เครื่องมือและระบบงานพร้อมใช้งาน
              </h2>
              <p className="mt-1 text-sm text-[#62705e]">เลือกเครื่องมือที่ต้องการใช้งาน</p>
            </div>
            <span className="w-fit rounded-full border border-[#acc5a6]/50 bg-[#e5efe3] px-3 py-1 text-xs font-semibold text-[#4b5c47]">
              {tools.length} เครื่องมือ
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map(({ title, description, icon: Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="group flex min-h-52 flex-col rounded-3xl border border-[#e2e6de] bg-white p-5 shadow-[0_2px_12px_-4px_rgba(26,33,25,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-[#acc5a6] hover:shadow-[0_12px_28px_-12px_rgba(75,92,71,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c7057] focus-visible:ring-offset-2 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0efe7] text-[#4b5c47] transition group-hover:bg-[#e5efe3]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-[#edf7f0] px-3 py-1 text-[11px] font-semibold text-[#32815e]">พร้อมใช้งาน</span>
                </div>
                <h3 className="mt-5 font-bold text-[#1a2119]">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#62705e]">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#4b5c47]">
                  เปิดเครื่องมือ <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
