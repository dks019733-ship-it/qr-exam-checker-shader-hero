import Link from "next/link";
import { ArrowDown, ArrowRight, BookOpenCheck, CheckCircle2, FileSpreadsheet, FileText, FolderLock, GraduationCap, ScanLine, Sparkles, Users, ChartNoAxesCombined, MessageCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/auth-buttons";

const features = [
  { id: "classes", title: "ห้องเรียนและนักเรียน", description: "จัดห้องเรียน นำเข้ารายชื่อจาก Excel และแก้ข้อมูลนักเรียน", icon: Users, href: "/dashboard/classes", label: "จัดการห้องเรียน" },
  { id: "answer-sheets", title: "กระดาษคำตอบ QR", description: "ตั้งค่าหัวกระดาษ เลือกห้อง แล้วพิมพ์กระดาษคำตอบพร้อม QR", icon: ScanLine, href: "/dashboard/answer-sheet", label: "เปิดเครื่องมือ" },
  { id: "exams", title: "จัดการข้อสอบ", description: "สร้างข้อสอบ เลือกห้องเรียน และกำหนดเฉลยก่อนเริ่มตรวจ", icon: FileText, href: "/dashboard/exams", label: "จัดการข้อสอบ" },
  { id: "scan", title: "ตรวจคำตอบ", description: "บันทึกคำตอบ คำนวณคะแนน และส่งผลที่ต้องตรวจให้ครูยืนยัน", icon: ScanLine, href: "/dashboard/scan", label: "เริ่มตรวจคำตอบ" },
  { id: "forms", title: "สมุดคะแนนและ Google Forms", description: "นำคะแนนจริงจาก Forms เข้าสมุดคะแนน จับคู่กับรายชื่อในห้อง และจับคู่อัตโนมัติเมื่อเพิ่มรายชื่อภายหลัง", icon: FileSpreadsheet, href: "/dashboard/gradebook", label: "เปิดสมุดคะแนน" },
  { id: "reports", title: "รายงานคะแนน", description: "ดูผลคะแนน แก้ไขสถานะตรวจทาน และดาวน์โหลดรายงาน", icon: ChartNoAxesCombined, href: "/dashboard/reports", label: "ดูรายงาน" },
  { id: "ai-tools", title: "ผู้ช่วย AI สำหรับครู", description: "เลือกแชท สร้างข้อสอบ Google Forms หรือสร้างเอกสาร แล้วตรวจร่างก่อนใช้", icon: Sparkles, href: "/dashboard/ai", label: "เลือกเครื่องมือ AI" },
];

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <main className="min-h-screen bg-[#f5f8f5] text-[#242e23] selection:bg-[#d1edd3] selection:text-[#3a4a36]">
      <div className="border-b border-[#5c7057]/30 bg-[#3a4a36] px-4 py-2 text-center text-xs font-medium tracking-wide text-[#eaf3e7]">
        <span className="inline-flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#acc5a6]" />พื้นที่รวมเครื่องมือช่วยงานครู</span>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-7 lg:px-10">
        <header className="relative z-20 flex items-center justify-between gap-3 rounded-2xl border border-[#acc5a6]/40 bg-white/85 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="งานของครู หน้าแรก">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#5c7057] text-[#eaf3e7]"><BookOpenCheck className="h-5 w-5" /></span>
            <span><span className="block font-bold leading-tight text-[#3a4a36]">งานของครู</span><span className="hidden text-[10px] font-semibold uppercase tracking-[.14em] text-[#789071] sm:block">Teacher workspace</span></span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="เมนูหลัก">
            <a href="#tools" className="rounded-full px-4 py-2 text-sm text-[#526350] hover:bg-[#d1edd3]/50">เครื่องมือ</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 text-sm text-[#526350] hover:bg-[#d1edd3]/50">เริ่มต้นใช้งาน</a>
            <a href="#forms" className="rounded-full px-4 py-2 text-sm text-[#526350] hover:bg-[#d1edd3]/50">คะแนน Forms</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {signedIn ? <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#5c7057] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3a4a36]">ไปหน้าเครื่องมือ<ArrowRight className="h-4 w-4" /></Link> : <SignInButton className="inline-flex items-center gap-2 rounded-full bg-[#5c7057] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3a4a36]" />}
            <details className="relative lg:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[#acc5a6]/60 text-[#3a4a36]" aria-label="เปิดเมนู"><span aria-hidden="true">☰</span></summary>
              <nav className="absolute right-0 top-12 z-30 flex w-52 flex-col rounded-2xl border border-[#acc5a6]/50 bg-white p-2 shadow-xl" aria-label="เมนูมือถือ">
                <a href="#tools" className="rounded-xl px-3 py-3 text-sm hover:bg-[#f1f6f0]">เครื่องมือ</a><a href="#how-it-works" className="rounded-xl px-3 py-3 text-sm hover:bg-[#f1f6f0]">เริ่มต้นใช้งาน</a><a href="#forms" className="rounded-xl px-3 py-3 text-sm hover:bg-[#f1f6f0]">คะแนน Forms</a>
              </nav>
            </details>
          </div>
        </header>

        <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-[#acc5a6]/40 bg-gradient-to-br from-white via-[#f7faf7] to-[#e7efe7] shadow-xl shadow-[#5c7057]/5">
          <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#d1edd3]/60 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-[#acc5a6]/35 blur-3xl" />
          <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.1fr_.9fr] lg:gap-14 lg:px-16 lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#89a482]/40 bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#526350] shadow-sm"><span className="h-2 w-2 rounded-full bg-[#5c7057]" />เครื่องมือในที่เดียว ออกแบบเพื่อครูไทย</div>
              <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.12] tracking-tight text-[#242e23] sm:text-5xl lg:text-6xl">จัดการ<span className="font-serif italic text-[#5c7057]"> งานของครู</span><span className="mt-2 block text-2xl font-medium leading-snug text-[#526350] sm:text-3xl lg:text-4xl">ให้ง่ายขึ้นในทุกวัน</span></h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-[#526350] sm:text-base">สร้างกระดาษคำตอบ QR ใช้ผู้ช่วย AI และจัดการงานการสอนจากหน้าเดียว เลือกเครื่องมือที่ต้องการก่อนเริ่มทำงานได้เลย</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {signedIn ? <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#5c7057] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#5c7057]/15 transition hover:bg-[#3a4a36]">เลือกเครื่องมือ<ArrowRight className="h-4 w-4" /></Link> : <SignInButton className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#5c7057] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#5c7057]/15 transition hover:bg-[#3a4a36]" />}
                <a href="#tools" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#acc5a6] bg-white/70 px-6 py-3 text-sm font-semibold text-[#3a4a36] transition hover:bg-white">ดูเครื่องมือทั้งหมด<ArrowDown className="h-4 w-4" /></a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#647761]"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />ครูเลือกก่อนว่าจะทำอะไร</span><span className="inline-flex items-center gap-1.5"><FolderLock className="h-4 w-4" />ข้อมูลแยกตามบัญชี</span></div>
            </div>

            <div className="mx-auto w-full max-w-md lg:max-w-none">
              <div className="rounded-[1.75rem] border border-white bg-white/85 p-4 shadow-2xl shadow-[#3a4a36]/10 backdrop-blur sm:p-6">
                <div className="flex items-center justify-between border-b border-[#e5ece3] pb-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d1edd3] text-[#5c7057]"><GraduationCap className="h-5 w-5" /></span><div><p className="text-sm font-bold text-[#3a4a36]">พื้นที่ทำงานของครู</p><p className="text-xs text-[#789071]">เลือกงานที่ต้องการเริ่ม</p></div></div><span className="rounded-full bg-[#f1f6f0] px-2.5 py-1 text-[10px] font-semibold text-[#5c7057]">WORKSPACE</span></div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#e5ece3] bg-[#fbfcfa] p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5eb] text-[#5c7057]"><ScanLine className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">กระดาษคำตอบ QR</p><p className="mt-0.5 text-xs text-[#748471]">เลือกห้องและเตรียมพิมพ์</p></div><ArrowRight className="h-4 w-4 text-[#789071]" /></div>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#e5ece3] bg-[#fbfcfa] p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5eb] text-[#5c7057]"><MessageCircle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">ผู้ช่วย AI</p><p className="mt-0.5 text-xs text-[#748471]">เลือกแชทหรือสร้างงานก่อน</p></div><ArrowRight className="h-4 w-4 text-[#789071]" /></div>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#e5ece3] bg-[#fbfcfa] p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5eb] text-[#5c7057]"><FileSpreadsheet className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">คะแนนจาก Forms</p><p className="mt-0.5 text-xs text-[#748471]">นำคะแนนจริงเข้ารวมในสมุดคะแนน</p></div></div>
                </div>
                <p className="mt-4 rounded-xl bg-[#f1f6f0] px-3 py-2.5 text-xs leading-5 text-[#647761]">เข้าระบบแล้วจะเห็นเมนูเครื่องมือ ไม่เปิดหน้าแชททันที</p>
              </div>
            </div>
          </div>
        </section>

        <section id="tools" className="scroll-mt-8 py-14 sm:py-16">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#789071]">YOUR TEACHER TOOLS</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#3a4a36] sm:text-3xl">เลือกสิ่งที่ต้องการทำ</h2></div><p className="max-w-lg text-sm leading-6 text-[#647761]">ผู้ช่วย AI มีหน้าแนะนำเครื่องมือก่อน ครูจึงเลือกแชทหรือสร้างเอกสารได้เอง</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ id, title, description, icon: Icon, href, label }) => {
              const card = <><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf5eb] text-[#5c7057]"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-base font-bold text-[#3a4a36]">{title}</h3><p className="mt-2 min-h-[3rem] text-sm leading-6 text-[#647761]">{description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5c7057]">{label}{id !== "forms" && <ArrowRight className="h-4 w-4" />}</span></>;
              const classes = "group rounded-3xl border border-[#acc5a6]/40 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#89a482] hover:shadow-lg";
              if (signedIn) return <Link id={id} key={id} href={href} className={classes}>{card}</Link>;
              return <article id={id} key={id} className={classes}>{card}<SignInButton redirectTo={href} label="เข้าสู่ระบบเพื่อเปิด" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#5c7057] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3a4a36]" /></article>;
            })}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 grid gap-5 rounded-[2rem] bg-[#3a4a36] p-6 text-white sm:p-9 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#c5d8bf]">GET STARTED</p><h2 className="mt-3 text-2xl font-bold sm:text-3xl">เริ่มจากงานที่ต้องการ</h2><p className="mt-3 text-sm leading-6 text-[#e0eadc]">ลงชื่อเข้าใช้ด้วย Google แล้วเลือกเครื่องมือจากหน้า workspace ทุกหน้ามีทางกลับไปหน้าเครื่องมือกลาง</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-xs text-[#c5d8bf]">01</span><p className="mt-2 text-sm font-semibold">เข้าสู่ระบบ</p><p className="mt-1 text-xs leading-5 text-[#e0eadc]">ใช้บัญชี Google ของครู</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-xs text-[#c5d8bf]">02</span><p className="mt-2 text-sm font-semibold">เลือกเครื่องมือ</p><p className="mt-1 text-xs leading-5 text-[#e0eadc]">กระดาษคำตอบหรือ AI</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-xs text-[#c5d8bf]">03</span><p className="mt-2 text-sm font-semibold">ตรวจแล้วบันทึก</p><p className="mt-1 text-xs leading-5 text-[#e0eadc]">ทบทวนงานก่อนนำไปใช้</p></div></div>
        </section>

        <footer className="mt-12 flex flex-col gap-3 border-t border-[#acc5a6]/40 pt-6 text-xs text-[#748471] sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="inline-flex items-center gap-2 font-semibold text-[#3a4a36]"><BookOpenCheck className="h-4 w-4" />งานของครู</Link><p>พื้นที่รวมเครื่องมือสำหรับจัดการงานการสอน</p>{signedIn && <Link href="/dashboard" className="inline-flex items-center gap-1 font-semibold text-[#5c7057]">หน้าเครื่องมือ<ArrowRight className="h-3.5 w-3.5" /></Link>}</footer>
      </div>
    </main>
  );
}
