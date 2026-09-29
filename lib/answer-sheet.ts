import { z } from "zod";

export const answerSheetTemplateSchema = z.object({
  schoolName: z.string().trim().min(1).max(200),
  logoDataUrl: z.string().max(700_000).nullable(),
  examTitle: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(200),
  questionCount: z.number().int().min(1).max(100),
  classLabel: z.string().trim().max(100),
});

export const bulkStudentSchema = z.object({
  classId: z.string().min(1),
  rows: z.array(z.object({
    rollNo: z.string().trim().min(1).max(20),
    studentNo: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(200),
  })).min(1).max(500),
});

export function isSafeImageDataUrl(value: string | null) {
  if (value === null) return true;
  if (value === "/school-logo-reference.png") return true;
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value);
}
