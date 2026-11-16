"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  GraduationCap,
  Home,
  Menu,
  ScanLine,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

const sections: { title: string; items: WorkspaceNavItem[] }[] = [
  {
    title: "พื้นที่ทำงาน",
    items: [{ href: "/", label: "ภาพรวม", icon: Home }],
  },
  {
    title: "จัดการห้องเรียน",
    items: [
      { href: "/dashboard/classes", label: "ห้องเรียนและนักเรียน", icon: Users },
      { href: "/dashboard/attendance", label: "เช็กชื่อเข้าเรียน", icon: CalendarCheck },
      { href: "/dashboard/assignments", label: "มอบหมายและติดตามงาน", icon: ClipboardList },
      { href: "/dashboard/subjects", label: "รายวิชาที่สอน", icon: BookOpen },
    ],
  },
  {
    title: "ข้อสอบและคะแนน",
    items: [
      { href: "/dashboard/exams", label: "จัดการข้อสอบ", icon: FileCheck2 },
      { href: "/dashboard/scan", label: "ตรวจข้อสอบด้วย QR", icon: ScanLine },
      { href: "/dashboard/answer-sheet", label: "กระดาษคำตอบ", icon: FileSpreadsheet },
      { href: "/dashboard/gradebook", label: "สมุดคะแนน", icon: BookOpen },
      { href: "/dashboard/reports", label: "รายงานคะแนน", icon: BarChart3 },
    ],
  },
  {
    title: "เครื่องมือเสริม",
    items: [{ href: "/dashboard/ai", label: "ผู้ช่วย AI สำหรับครู", icon: Sparkles }],
  },
];

const quickLinks: WorkspaceNavItem[] = [
  { href: "/", label: "หน้าแรก", icon: Home },
  { href: "/dashboard/classes", label: "ห้องเรียน", icon: Users },
  { href: "/dashboard/assignments", label: "งาน", icon: ClipboardList },
  { href: "/dashboard/gradebook", label: "คะแนน", icon: BookOpen },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [menuOpen, setMenuOpen] = useState(false);

  const renderLink = (item: WorkspaceNavItem, compact = false) => {
    const active = isActivePath(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        aria-current={active ? "page" : undefined}
        className={compact
          ? `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${active ? "bg-[#eaf0e7] text-[#38513a]" : "text-slate-500 hover:bg-slate-50"}`
          : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-[#eaf0e7] font-semibold text-[#38513a]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
      >
        <Icon className={compact ? "h-5 w-5" : "h-[18px] w-[18px] shrink-0"} aria-hidden="true" />
        <span className={compact ? "truncate" : "min-w-0 flex-1"}>{item.label}</span>
        {!compact && active && <span className="h-1.5 w-1.5 rounded-full bg-[#58745a]" aria-hidden="true" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f7f4]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#e4e9df] bg-[#fbfcf9] px-4 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2" aria-label="ระบบสารสนเทศ งานของครู">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#405640] text-white">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-[#263526]">ระบบสารสนเทศ งานของครู</span>
            <span className="mt-0.5 block text-[10px] text-slate-500">Teacher workspace</span>
          </span>
        </Link>

        <nav aria-label="เมนูระบบครู" className="mt-7 flex-1 space-y-6 overflow-y-auto pb-4">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 px-3 text-[10px] font-bold tracking-[0.12em] text-slate-400">{section.title}</h2>
              <div className="space-y-1">{section.items.map((item) => renderLink(item))}</div>
            </section>
          ))}
        </nav>

        <div className="border-t border-[#e4e9df] pt-3">
          <Link href="/student" className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <span>เข้าสู่พื้นที่นักเรียน</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <div className="min-h-screen pb-24 lg:pl-64 lg:pb-0">
        {children}
      </div>

      <nav aria-label="เมนูด่วนบนมือถือ" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] shadow-[0_-4px_20px_-12px_rgba(15,23,42,0.25)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {quickLinks.map((item) => renderLink(item, true))}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="workspace-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${menuOpen ? "bg-[#eaf0e7] text-[#38513a]" : "text-slate-500 hover:bg-slate-50"}`}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span>เมนูทั้งหมด</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <>
          <button type="button" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden" />
          <section id="workspace-mobile-menu" aria-label="เมนูทั้งหมด" className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 max-h-[65dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:hidden">
            {sections.map((section) => (
              <div key={section.title} className="mb-4 last:mb-0">
                <h2 className="mb-2 px-2 text-[10px] font-bold tracking-[0.12em] text-slate-400">{section.title}</h2>
                <div className="grid grid-cols-2 gap-1">{section.items.map((item) => renderLink(item))}</div>
              </div>
            ))}
            <Link href="/student" onClick={() => setMenuOpen(false)} className="mt-2 flex items-center justify-between border-t border-slate-100 px-2 pt-3 text-xs font-medium text-slate-500">
              เข้าสู่พื้นที่นักเรียน
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
