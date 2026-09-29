import Link from "next/link";
import { SignInButton } from "@/components/auth-buttons";

const items = [
  ["ภาพรวม", "#overview"],
  ["นักเรียน", "/dashboard/answer-sheet"],
  ["ข้อสอบ", "/dashboard/exams"],
  ["ตรวจข้อสอบ", "/dashboard/scan"],
  ["รายงาน", "/dashboard/reports"],
] as const;

export function HeroNavigation({ signedIn }: { signedIn: boolean }) {
  const renderItems = () => items.map(([label, href]) => {
    const className = "rounded-full px-3 py-2 text-xs font-light text-white/85 transition hover:bg-white/15 hover:text-white";
    if (href.startsWith("#")) return <Link key={label} href={href} className={className}>{label}</Link>;
    return signedIn
      ? <Link key={label} href={href} className={className}>{label}</Link>
      : <SignInButton key={label} redirectTo={href} className={className} label={label} />;
  });
  return (
    <>
      <nav aria-label="เมนูหลัก" className="hidden items-center space-x-1 lg:flex">{renderItems()}</nav>
      <details className="relative lg:hidden">
        <summary className="cursor-pointer list-none rounded-full border border-white/30 px-4 py-2 text-sm text-white">เมนู ☰</summary>
        <nav aria-label="เมนูหลักบนมือถือ" className="absolute right-0 top-12 z-50 flex min-w-44 flex-col rounded-xl border border-white/20 bg-slate-950/95 p-2 shadow-xl backdrop-blur">
          {renderItems()}
        </nav>
      </details>
    </>
  );
}

export function HeroLogin({ signedIn }: { signedIn: boolean }) {
  return signedIn
    ? <Link href="/dashboard" className="rounded-full bg-white px-6 py-2.5 text-xs font-medium text-black transition hover:bg-white/90">ไปที่ระบบ</Link>
    : <SignInButton redirectTo="/dashboard" className="rounded-full bg-white px-6 py-2.5 text-xs font-medium text-black transition hover:bg-white/90" label="เข้าสู่ระบบ" />;
}

export function HeroActions({ signedIn }: { signedIn: boolean }) {
  const outline = "rounded-full border-2 border-white/40 bg-transparent px-7 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:border-cyan-300 hover:bg-white/10 hover:text-cyan-100";
  const primary = "rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 hover:shadow-xl";
  const gated = (href: string, text: string, style: string) => signedIn
    ? <Link href={href} className={style}>{text}</Link>
    : <SignInButton redirectTo={href} className={style} label={text} />;
  return <div className="flex flex-wrap items-center gap-4">{gated("/dashboard/answer-sheet", "สร้างกระดาษคำตอบ", outline)}{gated("/dashboard", "เริ่มใช้งาน", primary)}</div>;
}
