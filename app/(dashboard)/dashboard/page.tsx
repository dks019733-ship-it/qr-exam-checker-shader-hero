import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileImage, FileText, GraduationCap, LayoutDashboard, ScanLine, Sparkles, Users, BookOpenCheck } from "lucide-react";
import { SignOutButton } from "@/components/auth-buttons";

const cards = [
  { title: "จัดการห้องเรียนและนักเรียน", description: "สร้างห้อง นำเข้ารายชื่อ แก้ไขข้อมูล และค้นหานักเรียน", icon: Users, href: "/dashboard/classes", status: "พร้อมใช้งาน" },
  { title: "จัดการข้อสอบ", description: "สร้างข้อสอบ เลือกห้องเรียน และกำหนดเฉลย", icon: FileText, href: "/dashboard/exams", status: "พร้อมใช้งาน" },
  { title: "ตรวจคำตอบ", description: "บันทึกคำตอบ คำนวณคะแนน และส่งให้ครูยืนยัน", icon: ScanLine, href: "/dashboard/scan", status: "พร้อมใช้งาน" },
  { title: "รายงานคะแนน", description: "ดูผลสอบ ยืนยันคะแนน และดาวน์โหลด CSV", icon: GraduationCap, href: "/dashboard/reports", status: "พร้อมใช้งาน" },
  { title: "สมุดคะแนนออนไลน์", description: "รวมข้อสอบและคะแนนเก็บ แบ่งกลางภาคและหลังกลางภาค พร้อมคำนวณยอดงาน/บทตาม SGS", icon: BookOpenCheck, href: "/dashboard/gradebook", status: "พร้อมใช้งาน" },
  { title: "กระดาษคำตอบ", description: "แก้ตราโรงเรียน วิชา ชื่อ รหัส และดูตัวอย่างก่อนพิมพ์", icon: FileImage, href: "/dashboard/answer-sheet", status: "พร้อมใช้งาน" },
  { title: "แชทกับ AI", description: "เริ่มสนทนาใหม่หรือกลับไปยังห้องสนทนาของคุณ", icon: Sparkles, href: "/dashboard/ai/chat", status: "พร้อมใช้งาน" },
  { title: "AI สร้าง Google Forms", description: "ให้ AI ร่างข้อสอบ ตรวจและอนุมัติ แล้วสร้าง Google Form พร้อมเฉลยและลิงก์ส่งนักเรียน", icon: ClipboardCheck, href: "/dashboard/ai/materials?kind=exam", status: "พร้อมใช้งาน" },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-7xl"><header className="flex flex-col gap-5 rounded-2xl border bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><LayoutDashboard className="h-4 w-4" />Workspace</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">สวัสดี{session.user.name ? ` ${session.user.name}` : ""}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">พื้นที่จัดการการสอบของคุณ เริ่มจากสร้างกระดาษคำตอบ หรือเลือกโมดูลที่ต้องการทำงาน</p></div><div className="flex items-center gap-2"><Link href="/dashboard/answer-sheet" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">สร้างกระดาษคำตอบ<ArrowRight className="ml-2 h-4 w-4" /></Link><SignOutButton /></div></header><div className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">โมดูลระบบ</h2><p className="mt-1 text-sm text-muted-foreground">เลือกส่วนที่ต้องการใช้งาน</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(({ title, description, icon: Icon, href, status }) => <Link key={title} href={href} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-5 w-5" /></div><span className={`rounded-full px-2.5 py-1 text-[11px] ${status === "พร้อมใช้งาน" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{status}</span></div><h3 className="mt-7 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-5 flex items-center text-xs font-medium text-muted-foreground group-hover:text-foreground">เปิดโมดูล<ArrowRight className="ml-1 h-3.5 w-3.5" /></div></Link>)}</div></div></div></main>;
}
