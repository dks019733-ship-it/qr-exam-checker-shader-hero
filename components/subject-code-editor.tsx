"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

export function SubjectCodeEditor({ teachingAssignmentId, initialCode, initialName }: {
  teachingAssignmentId: string; initialCode: string; initialName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/teaching-assignments/" + teachingAssignmentId, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "แก้ไขรายวิชาไม่สำเร็จ");
      setCode(data.subject.code); setName(data.subject.name);
      setEditing(false); setMessage("บันทึกแล้ว");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "แก้ไขรายวิชาไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  if (!editing) return <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs text-slate-500">{code} · {name}</span>
    <button type="button" onClick={() => { setEditing(true); setMessage(""); }} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"><Pencil className="h-3 w-3" />แก้ไข</button>
    {message && <span role="status" className="text-xs text-emerald-700">{message}</span>}
  </div>;

  return <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
    <input aria-label="รหัสวิชา" required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} className="min-w-0 rounded-lg border px-3 py-2 text-sm" />
    <input aria-label="ชื่อวิชา" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 rounded-lg border px-3 py-2 text-sm" />
    <div className="flex gap-2">
      <button type="button" disabled={busy || !code.trim() || !name.trim()} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check className="h-3 w-3" />บันทึก</button>
      <button type="button" disabled={busy} onClick={() => { setEditing(false); setCode(initialCode); setName(initialName); }} className="rounded-lg border px-3 py-2 text-xs"><X className="h-3 w-3" /></button>
    </div>
    {message && <p role="alert" className="text-xs text-rose-700 sm:col-span-3">{message}</p>}
  </div>;
}
