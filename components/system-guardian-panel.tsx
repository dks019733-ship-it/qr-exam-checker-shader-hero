"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

type Incident = {
  id: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  title: string;
  summary: string;
  route: string | null;
  occurrenceCount: number;
  lastSeenAt: string;
};

type GuardianTask = {
  id: string;
  type: "SYSTEM_HEALTH_CHECK";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  currentStep: string | null;
  progressPercent: number;
  resultSummary: string | null;
  failureCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Health = { ok: boolean; checks?: { database?: string } };

export function SystemGuardianPanel() {
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tasks, setTasks] = useState<GuardianTask[]>([]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskActionError, setTaskActionError] = useState("");
  const firstLoad = useRef(true);
  const seenTop = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [healthResponse, incidentResponse, taskResponse] = await Promise.all([
        fetch("/api/guardian/health", { cache: "no-store" }),
        fetch("/api/guardian/incidents", { cache: "no-store" }),
        fetch("/api/guardian/tasks", { cache: "no-store" }),
      ]);

      if ([healthResponse, incidentResponse, taskResponse].some((response) => response.status === 401)) {
        setLoadError(true);
        setHealth("error");
        return;
      }

      const [healthData, incidentData, taskData] = await Promise.all([
        healthResponse.json() as Promise<Health>,
        incidentResponse.json() as Promise<{ incidents?: Incident[] }>,
        taskResponse.json() as Promise<{ tasks?: GuardianTask[] }>,
      ]);
      if (!healthResponse.ok || !incidentResponse.ok || !taskResponse.ok) throw new Error("guardian request failed");

      const nextIncidents = incidentData.incidents ?? [];
      const newest = nextIncidents[0] ? `${nextIncidents[0].id}:${nextIncidents[0].lastSeenAt}` : null;

      if (!firstLoad.current && newest && newest !== seenTop.current) {
        setNotice(`อัปเดตเหตุการณ์ระบบ: ${nextIncidents[0].title}`);
      }
      seenTop.current = newest;
      firstLoad.current = false;

      setIncidents(nextIncidents);
      setTasks(taskData.tasks ?? []);
      setHealth(healthData.ok && healthData.checks?.database === "ok" ? "ok" : "error");
      setLastChecked(new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setLoadError(false);
    } catch {
      setHealth("error");
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function createHealthCheck() {
    setCreatingTask(true);
    setTaskActionError("");
    try {
      const response = await fetch("/api/guardian/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SYSTEM_HEALTH_CHECK", source: "WEB" }),
      });
      if (!response.ok) throw new Error("ไม่สามารถเพิ่มงานตรวจสอบได้");
      await refresh();
    } catch (error) {
      setTaskActionError(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setCreatingTask(false);
    }
  }

  async function cancelTask(taskId: string) {
    setTaskActionError("");
    try {
      const response = await fetch(`/api/guardian/tasks/${encodeURIComponent(taskId)}`, { method: "POST" });
      if (!response.ok) throw new Error("ยกเลิกไม่ได้ งานอาจเริ่มทำไปแล้ว");
      await refresh();
    } catch (error) {
      setTaskActionError(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    }
  }

  const activeIncidents = incidents.filter((item) => item.status !== "RESOLVED");
  const healthLabel = health === "ok" ? "ฐานข้อมูลปกติ" : health === "checking" ? "กำลังตรวจสอบ" : "ตรวจสอบไม่สำเร็จ";
  const taskStatusLabel: Record<GuardianTask["status"], string> = {
    QUEUED: "รอคิว",
    RUNNING: "กำลังทำ",
    SUCCEEDED: "สำเร็จ",
    FAILED: "ล้มเหลว",
    CANCELLED: "ยกเลิก",
  };

  return (
    <section aria-labelledby="guardian-title" className="relative overflow-hidden rounded-3xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3eb] text-[#4d5f4a]">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="guardian-title" className="text-base font-extrabold text-[#1c241b]">System Guardian</h2>
            <p className="mt-1 text-xs text-[#657360]">ติดตามสถานะระบบและงานตรวจสอบ · รีเฟรชทุก 5 วินาที</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e0e7d9] bg-[#f8faf6] px-3 py-1.5 text-xs font-semibold text-[#43543f]">
          {health === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {healthLabel}
        </div>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[#d7e5d2] bg-[#f1f6ee] px-3.5 py-3 text-xs font-medium text-[#344b31]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="shrink-0 text-[#657360] hover:text-[#1c241b]" aria-label="ปิดการแจ้งเตือน">ปิด</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#657360]">
        <span>{loadError ? "เชื่อมต่อข้อมูล Guardian ไม่สำเร็จ" : `Incident ที่ยังเปิดอยู่ ${activeIncidents.length} รายการ`}</span>
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          {lastChecked ? `ตรวจล่าสุด ${lastChecked}` : "รอผลตรวจ"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#283326]">งานตรวจสอบระบบ</h3>
          <p className="mt-1 text-xs text-[#657360]">งานที่ทำได้อัตโนมัติในขณะนี้จำกัดเฉพาะการตรวจสุขภาพระบบ</p>
        </div>
        <button type="button" onClick={createHealthCheck} disabled={creatingTask || loadError} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#2d3a2b] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#43543f] disabled:cursor-not-allowed disabled:opacity-50">
          {creatingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          เพิ่มงานตรวจสอบ
        </button>
      </div>
      {taskActionError && <p role="alert" className="mt-3 text-xs text-red-700">{taskActionError}</p>}
      <div className="mt-3 space-y-2">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dce6d8] bg-[#fafbf9] px-4 py-4 text-center text-xs text-[#657360]">ยังไม่มีงานตรวจสอบ</div>
        ) : tasks.slice(0, 5).map((task) => (
          <article key={task.id} className="rounded-2xl border border-[#edf0e9] px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#283326]">ตรวจสุขภาพระบบ · {task.id.slice(-8)}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${task.status === "FAILED" ? "bg-red-50 text-red-700" : task.status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-700" : task.status === "RUNNING" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{taskStatusLabel[task.status]}</span>
              </div>
              {task.status === "QUEUED" && <button type="button" onClick={() => cancelTask(task.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8b5145] hover:underline"><XCircle className="h-3 w-3" />ยกเลิก</button>}
            </div>
            <p className="mt-1 text-xs text-[#657360]">{task.currentStep ?? task.resultSummary ?? "รอรายละเอียด"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-[#7a9576] transition-all" style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }} /></div>
            <p className="mt-1 text-right text-[10px] text-[#899385]">{task.progressPercent}%</p>
          </article>
        ))}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-[#283326]">เหตุการณ์ระบบ</h3>
        <div className="mt-3 space-y-2">
          {activeIncidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dce6d8] bg-[#fafbf9] px-4 py-5 text-center text-sm text-[#657360]">
              {loadError ? "ยังไม่สามารถดึงข้อมูลสถานะได้" : "ไม่พบ Incident ที่ยังเปิดอยู่"}
            </div>
          ) : activeIncidents.slice(0, 5).map((incident) => (
            <article key={incident.id} className="flex items-start gap-3 rounded-2xl border border-[#edf0e9] px-3.5 py-3">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${incident.severity === "CRITICAL" || incident.severity === "ERROR" ? "text-[#b4533c]" : "text-[#9a783c]"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#283326]">{incident.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#657360]">{incident.summary}</p>
                <p className="mt-1 text-[11px] text-[#899385]">{incident.route ?? "ระบบ"} · เกิดซ้ำ {incident.occurrenceCount} ครั้ง</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f7f2e9] px-2 py-1 text-[10px] font-bold text-[#8b6b35]">{incident.severity}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
