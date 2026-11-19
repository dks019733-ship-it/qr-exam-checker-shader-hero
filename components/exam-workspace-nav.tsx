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
            className={`group flex min-h-[76px] min-w-0 items-start gap-2.5 rounded-2xl border px-3 py-3 transition sm:min-h-[88px] sm:gap-3 sm:px-4 ${selected ? "border-[#cbd8c5] bg-[#eaf0e6] text-[#294332] shadow-sm" : "border-[#e6e5dc] bg-white text-[#536052] hover:border-[#cbd4c5] hover:bg-[#fbfcf9]"}`}
          >
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white text-[#304a38]" : "bg-[#f3f4ef] text-[#71806f] group-hover:bg-[#eaf0e6]"}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold leading-5 sm:text-sm">{item.label}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-[#7a8577] sm:text-xs">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
