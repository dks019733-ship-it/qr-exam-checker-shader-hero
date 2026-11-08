import type { ReactNode } from "react";
import { Wrench, Clock3, CircleAlert } from "lucide-react";
import { getFeatureAvailability, formatFeatureUntil, type FeatureKey } from "@/lib/feature-availability";

export async function FeatureAvailabilityGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const state = await getFeatureAvailability(feature);
  if (state.status === "AVAILABLE") return <>{children}</>;

  const maintenance = state.status === "MAINTENANCE";
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-3xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          {maintenance ? <Wrench className="h-7 w-7 text-amber-600" /> : <CircleAlert className="h-7 w-7 text-slate-500" />}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SERVICE STATUS</p>
        <h1 className="mt-2 text-xl font-semibold">{state.name}</h1>
        <p className="mt-2 text-base font-medium">{maintenance ? "กำลังปิดปรับปรุงระบบ" : "ฟีเจอร์นี้ยังไม่พร้อมใช้งาน"}</p>
        {state.reason && <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{state.reason}</p>}
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          {maintenance ? `คาดว่าจะเปิดใช้งาน: ${formatFeatureUntil(state.untilAt)}` : formatFeatureUntil(state.untilAt)}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">กรุณากลับมาใช้งานอีกครั้งภายหลัง</p>
      </section>
    </main>
  );
}
