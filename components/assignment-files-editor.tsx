"use client";

import { useEffect, useState } from "react";
import { FileUp, Loader2, RefreshCw, Trash2 } from "lucide-react";

type FileRow = { id: string; fileName: string; contentType: string; sizeBytes: number };
type AssignmentRow = {
  id: string; groupId: string | null; title: string; description: string; dueAt: string | null;
  status: string; mode: string; classroom: { name: string };
  files: FileRow[]; _count: { submissions: number };
};

function formatSize(size: number) {
  return size < 1024 * 1024 ? Math.max(1, Math.round(size / 1024)) + " KB" : (size / (1024 * 1024)).toFixed(1) + " MB";
}

export function AssignmentFilesEditor({ assignmentId }: { assignmentId: string }) {
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/assignments", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error(data.error || "โหลดข้อมูลงานไม่สำเร็จ");
      const current = data.find((item: AssignmentRow) => item.id === assignmentId);
      if (!current) throw new Error("ไม่พบงานหรือไม่มีสิทธิ์เข้าถึง");
      const group = current.groupId ? data.filter((item: AssignmentRow) => item.groupId === current.groupId) : [current];
      setItems(group);
      setDescription(current.description || "");
      setDueAt(current.dueAt ? new Date(current.dueAt).toISOString().slice(0, 16) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลงานไม่สำเร็จ");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [assignmentId]);

  async function uploadToAssignment(id: string, file: File) {
    const presignResponse = await fetch("/api/files/presign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "assignment", parentId: id, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
    });
    const presign = await presignResponse.json();
    if (!presignResponse.ok) throw new Error(presign.error || "เตรียมอัปโหลดไฟล์ไม่สำเร็จ");
    const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!uploadResponse.ok) throw new Error("อัปโหลดไฟล์ " + file.name + " ไม่สำเร็จ");
    const completeResponse = await fetch("/api/files/complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "assignment", parentId: id, objectKey: presign.objectKey, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
    });
    const complete = await completeResponse.json();
    if (!completeResponse.ok) throw new Error(complete.error || "บันทึกไฟล์แนบไม่สำเร็จ");
  }

  async function save() {
    if (!items.length) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const detailResponse = await fetch("/api/assignments/" + assignmentId + "/edit", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, dueAt: dueAt ? new Date(dueAt).toISOString() : null }),
      });
      const detail = await detailResponse.json();
      if (!detailResponse.ok) throw new Error(detail.error || "บันทึกรายละเอียดงานไม่สำเร็จ");

      // A shared assignment is represented by one row per classroom. Keep its
      // teacher-provided instructions identical across every target classroom.
      for (const item of items) {
        const existing = new Set(item.files.map((file) => [file.fileName, file.contentType, file.sizeBytes].join(":")));
        for (const file of files) {
          const key = [file.name, file.type, file.size].join(":");
          if (!existing.has(key)) {
            await uploadToAssignment(item.id, file);
            existing.add(key);
          }
        }
      }
      setFiles([]);
      setNotice("บันทึกงานและเพิ่มไฟล์ประกอบให้ครบทุกห้องเรียนแล้ว");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกงานไม่สำเร็จ");
      await load();
    } finally { setSaving(false); }
  }

  async function removeFile(assignmentId: string, fileId: string) {
    if (!window.confirm("ยืนยันลบไฟล์นี้ออกจากงานทุกห้องเรียนที่อยู่ในชุดเดียวกัน?")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/assignments/" + assignmentId + "/files/" + fileId, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ลบไฟล์ไม่สำเร็จ");
      setNotice(data.cleanupPending ? "ลบรายการไฟล์แล้ว แต่ระบบจัดเก็บกำลังรอเก็บกวาดไฟล์ต้นฉบับ" : "ลบไฟล์ออกจากงานทุกห้องเรียนแล้ว");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไฟล์ไม่สำเร็จ");
    } finally { setSaving(false); }
  }

  async function openFile(fileId: string) {
    const response = await fetch("/api/files/download?kind=assignment&fileId=" + encodeURIComponent(fileId));
    const data = await response.json();
    if (response.ok && data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    else setError(data.error || "เปิดไฟล์ไม่สำเร็จ");
  }

  const allFiles = items.flatMap((item) => item.files.map((file) => ({ ...file, classroom: item.classroom.name })));
  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-[#e6e8df] bg-white p-5 shadow-sm sm:p-7">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#71816c]">TEACHER CONTROLS</p>
        <h1 className="mt-2 text-2xl font-extrabold">แก้ไขงานและไฟล์ประกอบ</h1>
        <p className="mt-2 text-sm text-[#687565]">{items[0]?.title || "กำลังโหลดงาน..."}{items[0] ? " · " + items.map((item) => item.classroom.name).join(", ") : ""}</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <p className="py-8 text-center text-sm text-slate-500">กำลังโหลด...</p> : (
        <>
          <label className="block text-sm font-semibold">รายละเอียด / คำชี้แจง
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={4} className="mt-2 w-full rounded-xl border border-[#dfe4d8] p-3 text-sm" />
          </label>
          <label className="block text-sm font-semibold">กำหนดส่ง
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#dfe4d8] px-3 text-sm" />
          </label>
          <div>
            <p className="text-sm font-semibold">ไฟล์งานที่นักเรียนเปิดดูได้</p>
            <p className="mt-1 text-xs text-slate-500">ครูเพิ่มไฟล์ได้ภายหลัง แม้งานเผยแพร่แล้ว นักเรียนดูหรือดาวน์โหลดได้เท่านั้น</p>
            {allFiles.length ? <ul className="mt-3 divide-y rounded-xl border">{allFiles.map((file, index) => <li key={file.id + index} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm"><span className="min-w-0 break-all">{file.fileName}<span className="ml-2 text-xs text-slate-400">{formatSize(file.sizeBytes)} · {file.classroom}</span></span><div className="flex gap-2"><button type="button" onClick={() => void openFile(file.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">เปิดไฟล์</button><button type="button" disabled={saving || items.some((item) => item._count.submissions > 0)} onClick={() => void removeFile(items.find((item) => item.files.some((entry) => entry.id === file.id))!.id, file.id)} title={items.some((item) => item._count.submissions > 0) ? "มีนักเรียนส่งงานแล้ว จึงลบไฟล์เดิมไม่ได้" : "ลบไฟล์"} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40"><Trash2 className="h-3 w-3" />ลบ</button></div></li>)}</ul> : <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">ยังไม่มีไฟล์แนบ</p>}
            <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd5c0] bg-[#f8faf6] p-4 text-center hover:bg-[#f0f5ed]">
              <FileUp className="h-5 w-5 text-[#4d5f4a]" />
              <span className="mt-2 text-sm font-semibold">เลือกไฟล์งานเพิ่มเติม</span>
              <span className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, WebP, DOC, DOCX · ไม่เกิน 10 MB ต่อไฟล์</span>
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
            </label>
            {files.length > 0 && <p className="mt-2 text-xs text-[#4d5f4a]">เลือกแล้ว {files.length} ไฟล์: {files.map((file) => file.name).join(", ")}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#4d5f4a] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</button>
            <button type="button" disabled={saving} onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm"><RefreshCw className="h-4 w-4" />รีเฟรช</button>
          </div>
        </>
      )}
    </section>
  );
}
