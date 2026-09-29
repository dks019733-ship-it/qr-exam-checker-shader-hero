"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Save, Search, Trash2, Upload, Users } from "lucide-react";
import * as XLSX from "xlsx";

type Classroom = { id: string; name: string; _count?: { students: number } };
type Student = { id: string; rollNo: string; studentNo: string; name: string; qrToken: string };

export function ClassroomManager() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [classId, setClassId] = useState("");
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentRows, setStudentRows] = useState("เลขที่,รหัสนักเรียน,ชื่อ-สกุล\n1,M401001,นักเรียนตัวอย่าง");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [studentName, setStudentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [roomColumn, setRoomColumn] = useState(-1);
  const [studentNoColumn, setStudentNoColumn] = useState(-1);
  const [rollNoColumn, setRollNoColumn] = useState(-1);
  const [nameColumn, setNameColumn] = useState(-1);

  const selectedClass = classes.find((row) => row.id === classId);
  const preview = useMemo(() => {
    if (roomColumn < 0 || rollNoColumn < 0 || studentNoColumn < 0 || nameColumn < 0 || !selectedClass) return [];
    const normalize = (value: string) => value.toLocaleLowerCase("th-TH").replace(/\s+/g, "").replace(/^(ห้อง|ม\.)/u, "");
    const wanted = normalize(selectedClass.name);
    return sheetRows.map((row) => ({
      rollNo: (row[rollNoColumn] || "").trim(),
      studentNo: (row[studentNoColumn] || "").trim(),
      name: (row[nameColumn] || "").trim(),
      room: (row[roomColumn] || "").trim(),
    })).filter((row) => normalize(row.room) === wanted && row.rollNo && row.studentNo && row.name);
  }, [sheetRows, roomColumn, rollNoColumn, studentNoColumn, nameColumn, selectedClass]);

  async function readRosterFile(file?: File) {
    if (!file) return;
    setNotice("");
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 15 MB");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
      const normalizeRoom = (value: string) => value.toLocaleLowerCase("th-TH").replace(/^(ห้อง|ม\.)/u, "").replace(/\s+/g, "");
      const roomPattern = /^(?:(?:ห้อง|ม\.)\s*)?\d+\s*[/.\-]\s*\d+$/u;
      const extractRoom = (value: string) => {
        const clean = value.trim();
        const known = classes.find((item) => normalizeRoom(clean) === normalizeRoom(item.name));
        if (known) return known.name;
        if (roomPattern.test(clean)) return clean;
        if (/(รายชื่อนักเรียน|ชั้น|ห้อง)/u.test(clean)) {
          const match = clean.match(/(\d+\s*[/.\-]\s*\d+)/u);
          if (match) return match[1].replace(/\s+/g, "");
        }
        return "";
      };
      const parsedRows: string[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
        const rows = matrix.map((row) => row.map((cell) => String(cell ?? "").trim()));
        const normalizeHeader = (cell: string) => cell.toLowerCase().replace(/[\s_\-–—./()]/g, "");
        const headerIndex = rows.slice(0, 30).findIndex((row) => row.some((cell) => /^(ชื่อ|ชื่อสกุล|ชื่อนามสกุล|name|fullname|studentname)$/iu.test(normalizeHeader(cell))));
        const header = headerIndex >= 0 ? rows[headerIndex].map(normalizeHeader) : [];
        const nameIndex = header.findIndex((cell) => /^(ชื่อ|ชื่อสกุล|ชื่อนามสกุล|name|fullname|studentname)$/u.test(cell));
        const rollNoIndex = header.findIndex((cell) => /^(เลขที่|ที่|ลำดับ|no|number|seatno|rollno)$/u.test(cell));
        const idIndex = header.findIndex((cell) => /^(รหัสนักเรียน|เลขประจำตัว|เลขที่นักเรียน|studentid|studentno|studentcode)$/u.test(cell));
        const roomIndex = header.findIndex((cell) => /^(ห้อง|ชั้นห้อง|ห้องเรียน|classroom|room|class|ชั้น|ระดับชั้น)$/u.test(cell));
        const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;
        let activeRoom = thisRoomName(sheetName, classes) ? sheetName : rows.slice(0, startIndex).map((row) => row.map(extractRoom).find(Boolean) || "").find(Boolean) || "";
        for (const row of rows.slice(startIndex)) {
          const marker = row.map(extractRoom).find(Boolean);
          if (marker) {
            activeRoom = marker;
            // Room headings can be merged title rows such as "รายชื่อนักเรียน ชั้นมัธยมศึกษาปีที่ 3/1".
            const markerIsHeading = row.some((cell) => /(รายชื่อนักเรียน|ชั้น|ห้อง)/u.test(cell));
            const markerIsOnlyCell = row.filter(Boolean).length === 1;
            if (markerIsHeading || markerIsOnlyCell || (nameIndex >= 0 && !row[nameIndex])) continue;
          }
          const room = (roomIndex >= 0 && row[roomIndex]) || activeRoom;
          if (!room) continue;
          const roll = rollNoIndex >= 0 ? row[rollNoIndex] : "";
          const id = idIndex >= 0 ? row[idIndex] : "";
          let name = nameIndex >= 0 ? row[nameIndex] : "";
          if (name && row.length > nameIndex + 1) {
            const surnameIndex = header.findIndex((cell, index) => index > nameIndex && /^(นามสกุล|lastname|surname)$/u.test(cell));
            if (surnameIndex >= 0 && row[surnameIndex]) name = `${name} ${row[surnameIndex]}`;
          }
          const normalizedId = id.toLowerCase().replace(/[\s_\-–—./()]/g, "");
          const normalizedName = name.toLowerCase().replace(/[\s_\-–—./()]/g, "");
          const repeatedHeader = /^(เลขที่|ที่|รหัสนักเรียน|เลขประจำตัว|studentid|studentno|id)$/u.test(normalizedId)
            || /^(ชื่อ|ชื่อสกุล|ชื่อนามสกุล|name|fullname|studentname)$/u.test(normalizedName);
          if (roll && id && name && !repeatedHeader) parsedRows.push([room, roll, id, name]);
        }
      }
      if (!parsedRows.length) throw new Error(`อ่านชีต “${workbook.SheetNames[0]}” ได้ แต่ไม่พบแถวที่มีทั้งชื่อและเลขที่/รหัสนักเรียน ช่องรายชื่อในไฟล์อาจยังว่าง หรือไฟล์นี้เป็นแบบฟอร์มเปล่า`);
      setHeaders(["ห้อง (จากหัวข้อ/ชื่อชีต)", "เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"]);
      setSheetRows(parsedRows);
      setRoomColumn(0); setRollNoColumn(1); setStudentNoColumn(2); setNameColumn(3);
      setFileName(file.name);
      const detected = [...new Set(parsedRows.map((row) => row[0]))];
      const matchingClass = classes.find((item) => detected.some((room) => normalizeRoom(room) === normalizeRoom(item.name)));
      if (matchingClass) {
        setClassId(matchingClass.id);
        setNotice(`พบรายชื่อห้อง ${matchingClass.name} ${parsedRows.filter((row) => normalizeRoom(row[0]) === normalizeRoom(matchingClass.name)).length} คน`);
      } else setNotice(`พบรายชื่อในห้อง ${detected.join(", ")} แต่ยังไม่มีห้องนี้ในระบบ กรุณาสร้างห้องให้ชื่อตรงกันก่อนนำเข้า`);
    } catch (error: any) {
      setFileName(""); setHeaders([]); setSheetRows([]);
      setNotice(error.message || "อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์ .xlsx, .xls หรือ .csv");
    }
  }

  function thisRoomName(sheetName: string, knownClasses: Classroom[]) {
    const normalize = (value: string) => value.toLocaleLowerCase("th-TH").replace(/^(ห้อง|ม\.)/u, "").replace(/\s+/g, "");
    return knownClasses.some((item) => normalize(item.name) === normalize(sheetName));
  }

  const filteredStudents = useMemo(() => students.filter((student) => `${student.studentNo} ${student.name}`.toLowerCase().includes(search.toLowerCase())), [students, search]);

  async function loadStudents(id: string) {
    if (!id) { setStudents([]); setSelectedId(""); setRollNo(""); setStudentNo(""); setStudentName(""); return; }
    const response = await fetch(`/api/students?classId=${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("โหลดรายชื่อนักเรียนไม่สำเร็จ");
    const rows: Student[] = await response.json();
    setStudents(rows);
    const current = rows.find((row) => row.id === selectedId) || rows[0];
    setSelectedId(current?.id || "");
    setRollNo(current?.rollNo || "");
    setStudentNo(current?.studentNo || "");
    setStudentName(current?.name || "");
  }

  useEffect(() => {
    fetch("/api/classes").then(async (response) => {
      if (!response.ok) throw new Error("โหลดห้องเรียนไม่สำเร็จ");
      return response.json();
    }).then((rows: Classroom[]) => {
      const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
      setClasses(unique);
      if (unique[0]) setClassId(unique[0].id);
    }).catch((error) => setNotice(error.message || "โหลดข้อมูลไม่สำเร็จ")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStudents(classId).catch((error) => setNotice(error.message || "โหลดรายชื่อนักเรียนไม่สำเร็จ"));
  // Keep the chosen student when a row list refreshes; class changes always reload from the server.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  function selectStudent(id: string) {
    const student = students.find((row) => row.id === id);
    setSelectedId(id);
    setRollNo(student?.rollNo || "");
    setStudentNo(student?.studentNo || "");
    setStudentName(student?.name || "");
  }

  async function createClass() {
    if (busy) return;
    if (!className.trim()) return setNotice("กรอกชื่อห้องเรียนก่อน");
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: className.trim() }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "สร้างห้องเรียนไม่สำเร็จ");
      setClasses((current) => current.some((row) => row.id === body.id) ? current : [...current, body]);
      setClassId(body.id); setClassName(""); setNotice("สร้างห้องเรียนแล้ว");
    } catch (error: any) { setNotice(error.message || "สร้างห้องเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function importStudents() {
    if (!classId) return setNotice("สร้างหรือเลือกห้องเรียนก่อนนำเข้านักเรียน");
    const lines = studentRows.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 501);
    const rows = lines.slice(lines[0]?.toLowerCase().includes("เลขที่") || lines[0]?.toLowerCase().includes("รหัส") || lines[0]?.toLowerCase().includes("student") ? 1 : 0)
      .map((line) => { const [rollNo, studentNo, ...name] = line.split(/[,|\t]/); return { rollNo: rollNo?.trim(), studentNo: studentNo?.trim(), name: name.join(",").trim() }; })
      .filter((row): row is { rollNo: string; studentNo: string; name: string } => Boolean(row.rollNo && row.studentNo && row.name));
    if (!rows.length) return setNotice("ไม่พบข้อมูล ใช้รูปแบบ เลขที่,รหัสนักเรียน,ชื่อ-สกุล");
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/students/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, rows }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "นำเข้านักเรียนไม่สำเร็จ");
      await loadStudents(classId);
      setNotice(`นำเข้ารายชื่อนักเรียน ${body.count} คนแล้ว`);
    } catch (error: any) { setNotice(error.message || "นำเข้านักเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function importPreview() {
    if (!classId) return setNotice("เลือกห้องเรียนก่อนนำเข้า");
    if (roomColumn < 0 || rollNoColumn < 0 || studentNoColumn < 0 || nameColumn < 0) return setNotice("เลือกคอลัมน์ห้อง เลขที่ รหัสนักเรียน และชื่อก่อน");
    const deduped = [...new Map(preview.map((row) => [row.studentNo, row])).values()].slice(0, 500);
    if (!deduped.length) return setNotice(`ไม่พบรายชื่อที่ตรงกับห้อง ${selectedClass?.name || ""} ตรวจชื่อห้องในไฟล์และห้องที่เลือก`);
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/students/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId, rows: deduped.map(({ rollNo, studentNo, name }) => ({ rollNo, studentNo, name })) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "นำเข้านักเรียนไม่สำเร็จ");
      await loadStudents(classId);
      setNotice(`นำเข้าห้อง ${selectedClass?.name}: ${body.count} คนแล้ว${preview.length > 500 ? " (จำกัด 500 คนต่อครั้ง)" : ""}`);
      setFileName(""); setHeaders([]); setSheetRows([]);
    } catch (error: any) { setNotice(error.message || "นำเข้านักเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function saveStudent() {
    if (!selectedId) return setNotice("เลือกรายชื่อนักเรียนก่อน");
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(selectedId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ rollNo, studentNo, name: studentName }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "บันทึกข้อมูลไม่สำเร็จ");
      setStudents((current) => current.map((row) => row.id === body.id ? body : row));
      setNotice("บันทึกข้อมูลนักเรียนแล้ว");
    } catch (error: any) { setNotice(error.message || "บันทึกข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function removeStudent() {
    const selected = students.find((row) => row.id === selectedId);
    if (!selected || !window.confirm(`เอา ${selected.name} ออกจากรายชื่อห้องนี้หรือไม่? ประวัติคะแนนเดิมจะยังอยู่`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "ลบนักเรียนไม่สำเร็จ");
      await loadStudents(classId);
      setNotice("เอานักเรียนออกจากรายชื่อแล้ว ประวัติคะแนนเดิมยังอยู่");
    } catch (error: any) { setNotice(error.message || "ลบนักเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function removeClassStudents() {
    if (!classId || !selectedClass) return;
    if (!students.length) return setNotice("ห้องนี้ไม่มีรายชื่อให้ลบ");
    if (!window.confirm(`เอารายชื่อนักเรียน ${students.length} คนออกจากห้อง ${selectedClass.name} ทั้งหมดหรือไม่? ประวัติคะแนนเดิมจะยังอยู่ และนำเข้ารายชื่อใหม่ภายหลังได้`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/students?classId=${encodeURIComponent(classId)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "เอารายชื่อออกไม่สำเร็จ");
      await loadStudents(classId);
      setNotice(`เอารายชื่อ ${body.count} คนออกจากห้องแล้ว ประวัติคะแนนเดิมยังอยู่`);
    } catch (error: any) { setNotice(error.message || "เอารายชื่อออกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f6f7f9] p-4 sm:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />กลับแดชบอร์ด</Link>
    <header className="mt-5 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3"><Users className="h-5 w-5" /></div><div><h1 className="text-2xl font-semibold">จัดการห้องเรียนและนักเรียน</h1><p className="mt-1 text-sm text-slate-600">สร้างห้อง นำเข้ารายชื่อ และแก้ไขข้อมูลนักเรียนได้ที่หน้านี้</p></div></div></header>
    {notice && <p role="status" className="mt-4 rounded-xl border bg-white px-4 py-3 text-sm">{notice}</p>}
    {loading ? <div className="mt-8 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด...</div> : <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section className="space-y-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">ห้องเรียน</h2><label className="mt-4 block text-sm">เลือกห้อง<select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">เลือกห้องเรียน</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.name} · {row._count?.students ?? (row.id === classId ? students.length : 0)} คน</option>)}</select></label><div className="mt-3 flex gap-2"><input value={className} onChange={(event) => setClassName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createClass(); } }} placeholder="เช่น ม.4/1" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button disabled={busy} onClick={createClass} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"><Plus className="mr-1 h-4 w-4" />สร้าง</button></div></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">นำเข้ารายชื่อนักเรียนจาก Excel</h2><p className="mt-1 text-xs text-slate-500">รองรับ .xlsx, .xls และ .csv · เลือกห้องที่สร้างไว้ก่อน ระบบจะนำเข้าเฉพาะแถวที่ห้องตรงกัน</p>
          <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void readRosterFile(event.dataTransfer.files[0]); }} className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-slate-50 px-4 py-6 text-center hover:bg-slate-100"><Upload className="mb-2 h-6 w-6 text-slate-500"/><span className="text-sm font-medium">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</span><span className="mt-1 text-xs text-slate-500">{fileName || "ไฟล์ต้องมีคอลัมน์ห้อง, เลขที่/รหัส และชื่อ"}</span><input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void readRosterFile(event.target.files?.[0])}/></label>
          {headers.length > 0 && <div className="mt-4 space-y-3"><p className="text-sm font-medium">ตรวจคอลัมน์ที่ระบบอ่านเจอ</p><div className="grid gap-2 sm:grid-cols-2">{([["ห้อง", roomColumn, setRoomColumn], ["เลขที่", rollNoColumn, setRollNoColumn], ["รหัสนักเรียน", studentNoColumn, setStudentNoColumn], ["ชื่อ-นามสกุล", nameColumn, setNameColumn]] as const).map(([label, value, setter]) => <label key={label} className="text-xs text-slate-600">{label}<select value={value} onChange={(event) => (setter as (index: number) => void)(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value={-1}>เลือกคอลัมน์</option>{headers.map((header, index) => <option key={`${index}-${header}`} value={index}>{header}</option>)}</select></label>)}</div>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">{classId ? <>กำลังเลือกห้อง <strong>{selectedClass?.name}</strong> · พบชื่อที่ตรงกัน <strong>{preview.length}</strong> คน</> : "เลือกห้องเรียนก่อนดูรายชื่อที่ตรงกัน"}{roomColumn >= 0 && rollNoColumn >= 0 && studentNoColumn >= 0 && nameColumn >= 0 && preview.length > 0 && <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-blue-200 pt-2 text-xs">{preview.slice(0, 8).map((row, index) => <li key={`${row.studentNo}-${index}`}>เลขที่ {row.rollNo} · รหัส {row.studentNo} · {row.name} · ห้อง {row.room}</li>)}{preview.length > 8 && <li>และอีก {preview.length - 8} คน</li>}</ul>}</div>
            <button disabled={busy || !classId || !preview.length || roomColumn < 0 || rollNoColumn < 0 || studentNoColumn < 0 || nameColumn < 0} onClick={importPreview} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}นำเข้าเฉพาะห้อง {selectedClass?.name || "ที่เลือก"}</button>
          </div>}
          <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-xs text-slate-600">หรือวางข้อมูลเอง</summary><p className="mt-2 text-xs text-slate-500">หนึ่งคนต่อบรรทัด: เลขที่,รหัสนักเรียน,ชื่อ-นามสกุล (สูงสุด 500 คน)</p><textarea value={studentRows} onChange={(event) => setStudentRows(event.target.value)} rows={5} className="mt-2 w-full rounded-lg border p-3 font-mono text-xs" /><button disabled={busy || !classId} onClick={importStudents} className="mt-2 inline-flex items-center rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Upload className="mr-2 h-4 w-4" />นำเข้าในห้องที่เลือก</button></details>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">รายชื่อนักเรียน{classId ? ` · ${classes.find((row) => row.id === classId)?.name || ""}` : ""}</h2><p className="mt-1 text-xs text-slate-500">{students.length} คนในห้องที่เลือก</p></div><div className="flex flex-wrap items-center gap-2"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือรหัส" className="rounded-lg border py-2 pl-9 pr-3 text-sm" /></label><button disabled={busy || !students.length} onClick={removeClassStudents} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5"/>เอารายชื่อเก่าออกทั้งห้อง</button></div></div>
        {!classId ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">เลือกหรือสร้างห้องเรียนก่อน</p> : !filteredStudents.length ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีนักเรียนในห้องนี้ นำเข้ารายชื่อจากช่องด้านซ้ายได้เลย</p> : <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">{filteredStudents.map((student) => <li key={student.id}><button onClick={() => selectStudent(student.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${selectedId === student.id ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"}`}><span className="font-medium">เลขที่ {student.rollNo}</span><span className="ml-3 text-slate-600">รหัส {student.studentNo}</span><span className="ml-3">{student.name}</span></button></li>)}</ul>}
        {selectedId && <div className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold">แก้ไขข้อมูลนักเรียน</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">เลขที่<input value={rollNo} onChange={(event) => setRollNo(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">รหัสนักเรียน<input value={studentNo} onChange={(event) => setStudentNo(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm sm:col-span-2">ชื่อ-นามสกุล<input value={studentName} onChange={(event) => setStudentName(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><div className="mt-3 flex gap-2"><button disabled={busy} onClick={saveStudent} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"><Save className="mr-2 h-4 w-4" />บันทึกข้อมูล</button><button disabled={busy} onClick={removeStudent} className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="mr-2 h-4 w-4"/>เอาออกจากห้อง</button></div></div>}
      </section>
    </div>}
  </div></main>;
}
