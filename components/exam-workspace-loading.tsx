import { ExamWorkspaceNav } from "@/components/exam-workspace-nav";

type Section = "exams" | "scan" | "sheets" | "scores";

export function ExamWorkspaceLoading({ active, title }: { active: Section; title: string }) {
  return (
    <main className="min-h-screen bg-[#f3f7f3] p-4 sm:p-7">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-[#dce8df] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[10px] font-semibold tracking-[.18em] text-[#6b8974]">TEACHER WORKSPACE</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1d422e]">{title}</h1>
          <p className="mt-1 text-sm text-[#78877c]">กำลังเตรียมข้อมูลล่าสุดให้พร้อมใช้งาน</p>
        </header>
        <div className="mt-4"><ExamWorkspaceNav active={active} /></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]" aria-label="กำลังเปิดพื้นที่ทำงาน">
          <div className="space-y-3 rounded-2xl border border-[#dce8df] bg-white p-5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-[#edf3ee]" />
            <div className="h-10 animate-pulse rounded-xl bg-[#f1f6f1]" />
            <div className="h-10 animate-pulse rounded-xl bg-[#f1f6f1]" />
            <div className="h-10 animate-pulse rounded-xl bg-[#f1f6f1]" />
          </div>
          <div className="space-y-4 rounded-2xl border border-[#dce8df] bg-white p-5">
            <div className="h-6 w-1/3 animate-pulse rounded bg-[#edf3ee]" />
            <div className="h-24 animate-pulse rounded-xl bg-[#f1f6f1]" />
            <div className="h-40 animate-pulse rounded-xl bg-[#f1f6f1]" />
          </div>
        </div>
      </div>
    </main>
  );
}
