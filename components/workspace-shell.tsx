"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight, BookOpen, CalendarCheck, ClipboardList, FileCheck2,
  GraduationCap, Home, Menu, PanelLeftClose, PanelLeftOpen,
  Sparkles, Users, X,
} from "lucide-react";

type WorkspaceNavItem = { href: string; label: string; icon: typeof Home };

const sections: { title: string; items: WorkspaceNavItem[] }[] = [
  { title: "พื้นที่ทำงาน", items: [{ href: "/", label: "ภาพรวม", icon: Home }] },
  { title: "จัดการห้องเรียน", items: [
    { href: "/dashboard/classes", label: "ห้องเรียนและนักเรียน", icon: Users },
    { href: "/dashboard/attendance", label: "เช็กชื่อเข้าเรียน", icon: CalendarCheck },
    { href: "/dashboard/assignments", label: "มอบหมายและติดตามงาน", icon: ClipboardList },
    { href: "/dashboard/subjects", label: "รายวิชาที่สอน", icon: BookOpen },
  ] },
  { title: "ข้อสอบและคะแนน", items: [
    { href: "/dashboard/exams", label: "ศูนย์จัดการข้อสอบ", icon: FileCheck2 },
    { href: "/dashboard/gradebook", label: "สมุดคะแนนออนไลน์", icon: BookOpen },
  ] },
  { title: "เครื่องมือเสริม", items: [{ href: "/dashboard/ai", label: "ผู้ช่วย AI สำหรับครู", icon: Sparkles }] },
];

const quickLinks: WorkspaceNavItem[] = [
  { href: "/", label: "หน้าแรก", icon: Home },
  { href: "/dashboard/classes", label: "ห้องเรียน", icon: Users },
  { href: "/dashboard/assignments", label: "งาน", icon: ClipboardList },
  { href: "/dashboard/gradebook", label: "คะแนน", icon: BookOpen },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/dashboard/exams" && ["/dashboard/exams", "/dashboard/scan", "/dashboard/answer-sheet"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("teacher-sidebar-collapsed") === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("teacher-sidebar-collapsed", String(next));
      return next;
    });
  }

  const renderLink = (item: WorkspaceNavItem, compact = false, collapsed = false) => {
    const active = isActivePath(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={compact
          ? `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors ${active ? "bg-[#e9eee5] text-[#304b38]" : "text-slate-500 hover:bg-[#f1f3ed] hover:text-[#263a2d]"}`
          : collapsed
            ? `mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${active ? "bg-[#e6ece2] text-[#304b38] shadow-inner" : "text-slate-500 hover:bg-[#f1f3ed] hover:text-[#263a2d]"}`
            : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${active ? "bg-[#e6ece2] font-semibold text-[#304b38] shadow-sm" : "text-slate-600 hover:bg-[#f1f3ed] hover:text-[#263a2d]"}`}
      >
        <Icon className={compact ? "h-5 w-5" : "h-[18px] w-[18px] shrink-0"} aria-hidden="true" />
        {!collapsed && <span className={compact ? "truncate" : "min-w-0 flex-1"}>{item.label}</span>}
        {!compact && !collapsed && active && <span className="h-1.5 w-1.5 rounded-full bg-[#9b8050]" aria-hidden="true" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f4ee]">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#e6e5dc] bg-[#fffefa] shadow-[8px_0_32px_-28px_rgba(28,43,32,0.35)] transition-[width] duration-200 lg:flex ${sidebarCollapsed ? "w-[5.25rem] px-2.5 py-5" : "w-64 px-4 py-5"}`}>
        <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-3" : "justify-between gap-2"}`}>
          <Link href="/" className={`flex min-w-0 items-center ${sidebarCollapsed ? "justify-center" : "gap-3 px-2"} py-2`} aria-label="งานของครู">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#304a38] to-[#1f3427] text-[#f8f4e9] shadow-[0_5px_14px_-7px_rgba(30,52,39,0.8)] ring-1 ring-[#9b8050]/30">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            {!sidebarCollapsed && <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold tracking-tight text-[#26382b]">งานของครู</span>
            </span>}
          </Link>
          <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"} aria-pressed={sidebarCollapsed} title={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e8e5da] text-[#657365] transition hover:border-[#c8cfbf] hover:bg-[#f2f3ed] hover:text-[#304a38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b8050]/50">
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className={`my-4 h-px bg-gradient-to-r from-transparent via-[#ded8c8] to-transparent ${sidebarCollapsed ? "mx-1" : "mx-2"}`} />
        <nav aria-label="เมนูระบบครู" className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden pb-4">
          {sections.map((section) => (
            <section key={section.title}>
              {!sidebarCollapsed && <h2 className="mb-2 px-3 text-[9px] font-bold tracking-[0.17em] text-[#a09276]">{section.title}</h2>}
              <div className={sidebarCollapsed ? "space-y-1" : "space-y-1"}>{section.items.map((item) => renderLink(item, false, sidebarCollapsed))}</div>
            </section>
          ))}
        </nav>

        <div className="border-t border-[#ebe8df] pt-3">
          <Link href="/student" title={sidebarCollapsed ? "เข้าสู่พื้นที่นักเรียน" : undefined} aria-label={sidebarCollapsed ? "เข้าสู่พื้นที่นักเรียน" : undefined} className={`flex items-center rounded-xl py-2.5 text-xs font-medium text-slate-500 transition hover:bg-[#f1f3ed] hover:text-[#263a2d] ${sidebarCollapsed ? "justify-center" : "justify-between px-3"}`}>
            {!sidebarCollapsed && <span>เข้าสู่พื้นที่นักเรียน</span>}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <div className={`min-h-screen pb-24 transition-[padding] duration-200 lg:pb-0 ${sidebarCollapsed ? "lg:pl-[5.25rem]" : "lg:pl-64"}`}>
        {children}
      </div>

      <nav aria-label="เมนูด่วนบนมือถือ" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e5dc] bg-[#fffefa]/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] shadow-[0_-8px_28px_-20px_rgba(31,48,36,0.35)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {quickLinks.map((item) => renderLink(item, true))}
          <button type="button" aria-expanded={menuOpen} aria-controls="workspace-mobile-menu" onClick={() => setMenuOpen((open) => !open)} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${menuOpen ? "bg-[#e9eee5] text-[#304b38]" : "text-slate-500 hover:bg-[#f1f3ed]"}`}>
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span>เมนูทั้งหมด</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <>
          <button type="button" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-[#1d2c22]/25 backdrop-blur-[2px] lg:hidden" />
          <section id="workspace-mobile-menu" aria-label="เมนูทั้งหมด" className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 max-h-[65dvh] overflow-y-auto rounded-2xl border border-[#e7e3d8] bg-[#fffefa] p-4 shadow-[0_24px_70px_-24px_rgba(22,37,27,0.35)] lg:hidden">
            {sections.map((section) => (
              <div key={section.title} className="mb-4 last:mb-0">
                <h2 className="mb-2 px-2 text-[9px] font-bold tracking-[0.17em] text-[#a09276]">{section.title}</h2>
                <div className="grid grid-cols-2 gap-1">{section.items.map((item) => renderLink(item))}</div>
              </div>
            ))}
            <Link href="/student" onClick={() => setMenuOpen(false)} className="mt-2 flex items-center justify-between border-t border-[#ebe8df] px-2 pt-3 text-xs font-medium text-slate-500">
              เข้าสู่พื้นที่นักเรียน
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
