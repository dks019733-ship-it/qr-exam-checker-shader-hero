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
    const className = "rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 sm:rounded-full sm:px-3 sm:py-2 sm:text-xs sm:font-normal sm:text-slate-600 sm:hover:bg-slate-100";
    if (href.startsWith("#")) return <Link key={label} href={href} className={className}>{label}</Link>;
    return signedIn
      ? <Link key={label} href={href} className={className}>{label}</Link>
      : <SignInButton key={label} redirectTo={href} className={className} label={label} />;
  });
  return (
    <>
      <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 lg:flex">{renderItems()}</nav>
      <details className="relative z-50 shrink-0 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm marker:hidden">☰<span className="ml-1.5">เมนู</span></summary>
        <nav aria-label="เมนูหลักบนมือถือ" className="fixed inset-x-3 top-[4.5rem] z-[60] mx-auto flex max-h-[calc(100dvh-6rem)] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:inset-x-auto sm:right-6 sm:top-20 sm:mx-0 sm:w-64">
          {renderItems()}
        </nav>
      </details>
    </>
  );
}

export function HeroLogin({ signedIn }: { signedIn: boolean }) {
  return signedIn
    ? <Link href="/dashboard" className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700 sm:rounded-full sm:px-6 sm:py-2.5">ไปที่ระบบ</Link>
    : <SignInButton redirectTo="/dashboard" className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700 sm:rounded-full sm:px-6 sm:py-2.5" label="เข้าสู่ระบบ" />;
}

export function HeroActions({ signedIn }: { signedIn: boolean }) {
  const outline = "rounded-xl border border-slate-300 bg-white/60 px-5 py-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-400 hover:bg-white sm:rounded-full sm:px-7 sm:py-3.5";
  const primary = "rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 sm:rounded-full sm:px-7 sm:py-3.5";
  const gated = (href: string, text: string, style: string) => signedIn
    ? <Link href={href} className={style}>{text}</Link>
    : <SignInButton redirectTo={href} className={style} label={text} />;
  return <div className="flex flex-wrap items-center gap-4">{gated("/dashboard/answer-sheet", "สร้างกระดาษคำตอบ", outline)}{gated("/dashboard", "เริ่มใช้งาน", primary)}</div>;
}
