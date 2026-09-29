import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, MessageCircle, NotebookPen, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";

const tools = [
  { title: "แชทกับ AI", description: "ถามเรื่องการสอน วางแผนกิจกรรม หรือช่วยคิดไอเดียในห้องเรียน", href: "/dashboard/ai/chat", icon: MessageCircle },
  { title: "สร้างข้อสอบและ Google Forms", description: "ให้ AI ร่างข้อสอบ ตรวจและอนุมัติก่อน แล้วสร้างแบบทดสอบพร้อมเฉลยและลิงก์ให้นักเรียน", href: "/dashboard/ai/materials?kind=exam", icon: FileText },
  { title: "สร้างเอกสาร", description: "สร้างใบงานหรือเอกสารประกอบการสอน แล้วตรวจทานก่อนดาวน์โหลด", href: "/dashboard/ai/materials?kind=document", icon: NotebookPen },
  { title: "งานของฉัน", description: "กลับไปตรวจ แก้ไข หรือดาวน์โหลดงานที่อนุมัติแล้ว", href: "/dashboard/ai/materials", icon: FileText },
];

export default async function AIDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />กลับแดชบอร์ด</Link>
    <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Sparkles className="h-5 w-5" /></div><h1 className="mt-4 text-3xl font-semibold tracking-tight">ผู้ช่วย AI สำหรับครู</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">ใช้บัญชีเว็บเดิมได้เลย งานที่สร้างจะเป็นฉบับรอตรวจเสมอ และดาวน์โหลดได้หลังครูอนุมัติ</p></header>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {tools.map(({ title, description, href, icon: Icon }) => <Link key={title} href={href} className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-5 w-5" /></div><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-5 flex items-center text-xs font-medium text-muted-foreground group-hover:text-foreground">เปิดใช้งาน<ArrowRight className="ml-1 h-3.5 w-3.5" /></div></Link>)}
    </div>
  </div></main>;
}
