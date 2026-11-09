"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Save, Upload } from "lucide-react";

type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };

type Props = {
  classId: string;
  students: Student[];
  selectedStudentId: string;
  onSelect: (student: Student) => void;
  onStudentsChange: (students: Student[]) => void;
};

type ParsedRow = { rollNo: string; studentNo: string; name: string };

function parseDelimitedRows(source: string): string[][] {
  const delimiter = source.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) return [];
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}
function parseStudentRows(source: string): ParsedRow[] {
  if (!source.trim()) return [];
  const cells = parseDelimitedRows(source);
  if (!cells.length) return [];
  const first = cells[0].map((cell) => cell.toLocaleLowerCase());
  const hasHeader = first.some((cell) => /รหัส|ชื่อ|student.?no|roll.?no|name/.test(cell));
  const data = hasHeader ? cells.slice(1) : cells;

  return data.map((row, index) => {
    if (row.length >= 3) return { rollNo: row[0], studentNo: row[1], name: row.slice(2).join(",").trim() };
    return { rollNo: String(index + 1), studentNo: row[0] ?? "", name: row.slice(1).join(",").trim() };
  }).filter((row) => row.studentNo && row.name);
}

export function AnswerSheetStudentTools({ classId, students, selectedStudentId, onSelect, onStudentsChange }: Props) {
  const [source, setSource] = useState("");
  const [editing, setEditing] = useState({ rollNo: "", studentNo: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(() => students.find((student) => student.id === selectedStudentId) ?? null, [students, selectedStudentId]);
  const parsedRows = useMemo(() => parseStudentRows(source), [source]);

  useEffect(() => {
    setEditing(selected ? { rollNo: selected.rollNo, studentNo: selected.studentNo, name: selected.name } : { rollNo: "", studentNo: "", name: "" });
  }, [selected?.id, selected?.rollNo, selected?.studentNo, selected?.name]);

  async function reloadStudents(preferredId?: string) {
    const response = await fetch(`/api/students?classId=${encodeURIComponent(classId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("โหลดรายชื่อนักเรียนล่าสุดไม่สำเร็จ");
    const rows = await response.json() as Student[];
    onStudentsChange(rows);
    const preferred = rows.find((student) => student.id === preferredId) ?? rows[0];
    if (preferred) onSelect(preferred);
  }

  async function saveStudent() {
    if (!selected) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/students/${selected.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "บันทึกข้อมูลนักเรียนไม่สำเร็จ");
      await reloadStudents(selected.id);
      setMessage("บันทึกข้อมูลนักเรียนแล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function importStudents() {
    if (!classId || !parsedRows.length) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classId, rows: parsedRows }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "นำเข้ารายชื่อนักเรียนไม่สำเร็จ");
      await reloadStudents();
      setSource("");
      setMessage(`นำเข้าหรืออัปเดตนักเรียน ${body.count} คนแล้ว`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "นำเข้ารายชื่อไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!classId) return <p className="text-sm text-slate-500">เลือกห้องเรียนก่อนจัดการรายชื่อนักเรียน</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-3">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="answer-sheet-student-csv">วางรายชื่อนักเรียน (รหัสนักเรียน, ชื่อ-สกุล)</label>
        <textarea
          id="answer-sheet-student-csv"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          rows={5}
          placeholder={"รหัสนักเรียน,ชื่อ-สกุล\nM401001,สมชาย ใจดี\nM401002,สมหญิง ใจงาม"}
          className="mt-2 w-full rounded-lg border bg-white p-3 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">รองรับ CSV หรือคัดลอกจาก Excel/Google Sheets · หากมี 2 คอลัมน์ ระบบกำหนดเลขที่ตามลำดับ</span>
          <button type="button" onClick={importStudents} disabled={saving || !parsedRows.length} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            นำเข้า {parsedRows.length} คน
          </button>
        </div>
        {source.trim() && <p className="mt-2 text-xs text-muted-foreground">อ่านข้อมูลได้ {parsedRows.length} แถว</p>}
      </div>

      {selected && (
        <div className="rounded-xl border p-3">
          <p className="mb-3 text-sm font-medium">แก้ไขข้อมูลนักเรียนที่เลือก</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">เลขที่<input value={editing.rollNo} maxLength={20} onChange={(event) => setEditing((current) => ({ ...current, rollNo: event.target.value }))} className="mt-1 w-full rounded-lg border p-2 text-sm text-foreground" /></label>
            <label className="text-xs text-muted-foreground">รหัสนักเรียน<input value={editing.studentNo} maxLength={50} onChange={(event) => setEditing((current) => ({ ...current, studentNo: event.target.value }))} className="mt-1 w-full rounded-lg border p-2 text-sm text-foreground" /></label>
            <label className="col-span-2 text-xs text-muted-foreground">ชื่อ-สกุล<input value={editing.name} maxLength={200} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border p-2 text-sm text-foreground" /></label>
          </div>
          <button type="button" onClick={saveStudent} disabled={saving || !editing.rollNo.trim() || !editing.studentNo.trim() || !editing.name.trim()} className="mt-3 inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}บันทึกนักเรียน
          </button>
        </div>
      )}

      {(message || error) && <p role="status" aria-live="polite" className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || <><Check className="mr-1 inline h-4 w-4" />{message}</>}</p>}
    </div>
  );
}
