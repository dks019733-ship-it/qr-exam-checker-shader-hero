import "server-only";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  if (!row && key === "answer_sheet") {\n    return { key, name: FEATURE_CATALOG[key], status: "UNAVAILABLE" as const, reason: "อยู่ระหว่างเตรียมพัฒนา", untilAt: null };\n  }\n  if (!row || row.status === "AVAILABLE" || (row.untilAt && row.untilAt.getTime() <= Date.now())) {
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

export async function featureAvailabilityResponse(key: FeatureKey) {
  const state = await getFeatureAvailability(key);
  if (state.status === "AVAILABLE") return null;
  return NextResponse.json({
    error: state.status === "MAINTENANCE" ? "ระบบกำลังปิดปรับปรุง" : "ฟีเจอร์นี้ยังไม่พร้อมใช้งาน",
    featureAvailability: { key, name: state.name, status: state.status, reason: state.reason, untilAt: state.untilAt },
  }, { status: 503 });
}
