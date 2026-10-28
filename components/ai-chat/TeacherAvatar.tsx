import type { TeacherAiProfile } from "@/lib/teacher-ai-profile";

const looks: Record<string, { shirt: string; hair: string; accent: string }> = {
  "เอิร์ทโทน": { shirt: "#9b7358", hair: "#45352e", accent: "#e4c9a8" },
  "ครูสบายๆ": { shirt: "#788b78", hair: "#423b35", accent: "#d6ddd0" },
  "เสื้อกาวน์": { shirt: "#f4f1e8", hair: "#524239", accent: "#9caf9d" },
  "ชุดสร้างสรรค์": { shirt: "#9a8194", hair: "#46394a", accent: "#e5c4aa" },
  "ชุดไทยร่วมสมัย": { shirt: "#aa8462", hair: "#3a302d", accent: "#d9ba8e" },
};

export function TeacherAvatar({ profile, size = 96 }: { profile: TeacherAiProfile; size?: number }) {
  const look = looks[profile.outfit] || looks["เอิร์ทโทน"];
  const feminine = /หญิง|fem/i.test(profile.gender);
  const bodyId = `body-${profile.outfit.replace(/\W/g, "")}`;
  return (
    <div className="relative shrink-0 rounded-[1.35rem] border border-[#e5ded1] bg-gradient-to-br from-[#f4f0e7] via-[#eee9de] to-[#e2e9df] p-1 shadow-sm" style={{ width: size, height: size }} aria-label={`ตัวละคร ${profile.name} ลักษณะ ${profile.gender} ใส่${profile.outfit}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-hidden="true">
        <defs><clipPath id={bodyId}><rect x="0" y="0" width="120" height="120" rx="22" /></clipPath></defs>
        <g clipPath={`url(#${bodyId})`}>
          <circle cx="96" cy="20" r="23" fill={look.accent} opacity=".48" />
          <path d="M14 120c2-25 20-36 46-36s44 11 46 36" fill={look.shirt} />
          <path d="M43 84l17 18 17-18-5-9H48z" fill="#f5eee2" opacity=".95" />
          <ellipse cx="60" cy="51" rx="22" ry="27" fill="#d5a781" />
          {feminine ? <path d="M37 53c-7-21 2-39 24-39 20 0 29 17 22 39l-5 18-5-22c-6 2-19 1-29-6l-5 27z" fill={look.hair} /> : <path d="M38 43c1-20 14-29 27-28 14 1 22 12 19 29-8-7-19-10-30-9-6 0-11 3-16 8" fill={look.hair} />}
          <ellipse cx="51" cy="53" rx="2" ry="2.5" fill="#473930" />
          <ellipse cx="69" cy="53" rx="2" ry="2.5" fill="#473930" />
          <path d="M54 65c4 3 8 3 12 0" fill="none" stroke="#8f5c4c" strokeWidth="2" strokeLinecap="round" />
          <path d="M43 46c4-3 8-4 12-3M65 43c4-1 8 0 12 3" fill="none" stroke={look.hair} strokeWidth="2.5" strokeLinecap="round" />
          {profile.outfit === "เสื้อกาวน์" && <path d="M48 87l12 15 12-15 12 33H36z" fill="#fcfbf7" stroke="#d8d4ca" strokeWidth="1.5" />}
          {profile.outfit === "ชุดไทยร่วมสมัย" && <path d="M42 87l18 15 18-15 8 33H34z" fill="#b18b67" opacity=".8" />}
          {profile.outfit === "ชุดสร้างสรรค์" && <path d="M45 89l15 13 15-13 9 31H36z" fill="#987a91" opacity=".85" />}
          <circle cx="43" cy="61" r="2.5" fill={look.accent} />
          <circle cx="77" cy="61" r="2.5" fill={look.accent} />
        </g>
      </svg>
      <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-white bg-[#6d8a70]" />
    </div>
  );
}
