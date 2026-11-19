"use client";

import Link from "next/link";
import { BarChart3, FileCheck2, FileSpreadsheet, ScanLine } from "lucide-react";

type ExamWorkspaceSection = "exams" | "scan" | "sheets" | "scores";

const items: { id: ExamWorkspaceSection; href: string; label: string; description: string; icon: typeof FileCheck2 }[] = [
  { id: "exams", href: "/dashboard/exams", label: "จัดการข้อสอบ", description: "สร้างข้อสอบและกำหนดเฉลย", icon: FileCheck2 },
  { id: "scan", href: "/dashboard/scan", label: "ตรวจคำตอบ", description: "สแกนและตรวจผลรายห้อง", icon: ScanLine },
  { id: "sheets", href: "/dashboard/answer-sheet", label: "กระดาษคำตอบ", description: "ตั้งค่าและพิมพ์แบบฟอร์ม", icon: FileSpreadsheet },
  { id: "scores", href: "/dashboard/exams?tab=scores", label: "รายงานคะแนน", description: "ตรวจยืนยันและดูผลสอบ", icon: BarChart3 },
];

export function ExamWorkspaceNav({ active, onNavigate }: { active: ExamWorkspaceSection; onNavigate?: (section: ExamWorkspaceSection) => void }) {
  return (
    <nav aria-label="เมนูศูนย์จัดการข้อสอบ" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch
            aria-current={selected ? "page" : undefined}
            onClick={() => onNavigate?.(item.id)}
            className={`group flex min-h-[76px] min-w-0 items-start gap-2.5 rounded-2xl border px-3 py-3 transition sm:min-h-[88px] sm:gap-3 sm:px-4 ${selected ? "border-[#1d4b35] bg-[#1d4b35] text-white shadow-md shadow-[#1d4b35]/10" : "border-[#e1eae2] bg-white text-[#536b5b] hover:border-[#b9d4bf] hover:bg-[#f7fbf7]"}`}
          >
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white/10 text-white" : "bg-[#edf4ee] text-[#66806d] group-hover:bg-[#e2eee4]"}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold leading-5 sm:text-sm">{item.label}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-[#d5e6d9] sm:text-xs">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
