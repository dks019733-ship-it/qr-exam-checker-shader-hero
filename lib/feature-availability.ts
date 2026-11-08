import "server-only";

import { prisma } from "@/lib/prisma";

export const FEATURE_CATALOG = {
  answer_sheet: "ระบบกระดาษคำตอบ",
  attendance: "ระบบเช็กชื่อ",
  assignments: "ระบบมอบหมายงาน",
  exams: "ระบบจัดการข้อสอบ",
  gradebook: "ระบบบันทึกคะแนน",
  ai: "ระบบผู้ช่วย AI",
} as const;

export type FeatureKey = keyof typeof FEATURE_CATALOG;
export type FeatureState = "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";

export async function getFeatureAvailability(key: FeatureKey) {
  const row = await prisma.featureAvailability.findUnique({ where: { key } });
  if (!row || row.status === "AVAILABLE" || (row.untilAt && row.untilAt.getTime() <= Date.now())) {
    return { key, name: FEATURE_CATALOG[key], status: "AVAILABLE" as const, reason: "", untilAt: null };
  }
  return { key, name: FEATURE_CATALOG[key], status: row.status, reason: row.reason, untilAt: row.untilAt };
}

export function formatFeatureUntil(value: Date | null) {
  if (!value) return "ยังไม่กำหนดเวลาเปิดใช้งาน";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
