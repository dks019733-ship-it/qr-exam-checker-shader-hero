export type TeacherAiProfile = {
  name: string;
  gender: string;
  outfit: string;
  instructions: string;
};

export const defaultTeacherAiProfile: TeacherAiProfile = {
  name: "น้องใบชา",
  gender: "ไม่ระบุเพศ",
  outfit: "เอิร์ทโทน",
  instructions: "ตอบเป็นภาษาไทย อ่านง่าย และช่วยคิดแบบลงมือใช้ในห้องเรียนได้จริง",
};

const teacherAiProfileStoragePrefix = "qr-exam-teacher-ai-profile-v1";

export async function getTeacherAiProfileStorageKey() {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const session = await response.json();
    const userId = typeof session?.user?.id === "string" ? session.user.id : "guest";
    return `${teacherAiProfileStoragePrefix}:${userId}`;
  } catch {
    return `${teacherAiProfileStoragePrefix}:guest`;
  }
}

export function sanitizeTeacherAiProfile(value: unknown): TeacherAiProfile {
  const profile = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    name: typeof profile.name === "string" ? profile.name.trim().slice(0, 32) || defaultTeacherAiProfile.name : defaultTeacherAiProfile.name,
    gender: typeof profile.gender === "string" ? profile.gender.trim().slice(0, 48) || defaultTeacherAiProfile.gender : defaultTeacherAiProfile.gender,
    outfit: typeof profile.outfit === "string" ? profile.outfit.trim().slice(0, 48) || defaultTeacherAiProfile.outfit : defaultTeacherAiProfile.outfit,
    instructions: typeof profile.instructions === "string" ? profile.instructions.trim().slice(0, 1200) : defaultTeacherAiProfile.instructions,
  };
}
