import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_PAGE_URL = "https://www.mks.ac.th/about/19-std/399-std";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_STUDENTS = 500;

function normalize(value: string) {
  return value.toLocaleLowerCase("th-TH").replace(/[\\s_\\-–—./()]/g, "");
}

function classKey(value: string) {
  const clean = value.trim();
  const match = clean.match(/(?:มัธยมศึกษาปีที่|ชั้นมัธยมศึกษาปีที่|มัธยม|ชั้น|ห้อง|ม\\.?\\s*)?\\s*([1-6])\\s*[/.\\-]\\s*(\\d+)/u);
  return match ? `${match[1]}/${match[2]}` : "";
}

function classKeyFromClassName(value: string) {
  return classKey(value) || classKey(value.replace(/^ม\\.?\\s*/u, ""));
}

async function resolveSourceWorkbookUrl() {
  const page = await fetch(SOURCE_PAGE_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "text/html" },
  });
  if (!page.ok) throw new Error(`เปิดหน้าแหล่งข้อมูลโรงเรียนไม่สำเร็จ (HTTP ${page.status})`);
  const html = await page.text();
  if (html.length > 2 * 1024 * 1024) throw new Error("หน้าแหล่งข้อมูลมีขนาดใหญ่เกินกำหนด");
  const links = [...html.matchAll(/href\\s*=\\s*(["'])([^"']+\\.xlsx(?:\\?[^"']*)?)\\1/giu)];
  for (const match of links) {
    const href = match[2].replace(/&amp;/gu, "&");
    const candidate = new URL(href, SOURCE_PAGE_URL);
    if (candidate.protocol === "https:" && ["www.mks.ac.th", "mks.ac.th"].includes(candidate.hostname) && candidate.pathname.toLowerCase().endsWith(".xlsx")) {
      return candidate.toString();
    }
  }
  throw new Error("ไม่พบลิงก์ไฟล์ Excel บนหน้าเว็บไซต์โรงเรียน กรุณาใช้ Excel ด้วยตนเอง");
}

function parseRoster(buffer: Buffer, requestedClass: string) {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellText: true });
  const wantedClass = classKeyFromClassName(requestedClass);
  if (!wantedClass) throw new Error("ชื่อห้องต้องอยู่ในรูปแบบ ม.4/1 หรือ 4/1");

  const found: { rollNo: string; studentNo: string; name: string }[] = [];
  let recognizedHeader = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    let rollIndex = -1;
    let idIndex = -1;
    let nameIndex = -1;
    let activeClass = "";

    for (const rawRow of matrix) {
      const row = rawRow.map((cell) => String(cell ?? "").trim());
      const normalized = row.map(normalize);
      const nextRoll = normalized.findIndex((cell) => cell === "เลขที่" || cell === "ลำดับ");
      const nextId = normalized.findIndex((cell) => cell === "เลขประจำตัว" || cell === "รหัสนักเรียน" || cell === "เลขที่นักเรียน");
      const nextName = normalized.findIndex((cell) => cell === "ชื่อนามสกุล" || cell === "ชื่อสกุล" || cell === "ชื่อ");

      if (nextRoll >= 0 && nextId >= 0 && nextName >= 0) {
        rollIndex = nextRoll;
        idIndex = nextId;
        nameIndex = nextName;
        recognizedHeader = true;
        continue;
      }

      const headingCell = row.find((cell) => /(?:มัธยมศึกษาปีที่|ชั้นมัธยมศึกษาปีที่|มัธยม|ชั้น|ห้อง|ม\\.?\\s*)/u.test(cell) && classKey(cell));
      if (headingCell) {
        activeClass = classKey(headingCell);
        continue;
      }

      if (!activeClass && classKey(sheetName)) activeClass = classKey(sheetName);
      if (activeClass !== wantedClass || rollIndex < 0 || idIndex < 0 || nameIndex < 0) continue;

      const rollNo = (row[rollIndex] || "").trim();
      const studentNo = (row[idIndex] || "").trim();
      const name = (row[nameIndex] || "").replace(/\\s+/gu, " ").trim();
      if (!rollNo || !studentNo || !name) continue;
      if (!/^\\d{1,3}$/u.test(rollNo) || !/^\\d{3,20}$/u.test(studentNo)) continue;
      if (/^(เลขที่|เลขประจำตัว|ชื่อ|ชื่อ นามสกุล)$/u.test(name)) continue;
      found.push({ rollNo, studentNo, name });
    }
  }

  if (!recognizedHeader) throw new Error("ไม่พบหัวตาราง เลขที่ / เลขประจำตัว / ชื่อ นามสกุล ในไฟล์ต้นทาง");
  const unique = new Map<string, { rollNo: string; studentNo: string; name: string }>();
  for (const student of found) {
    const existing = unique.get(student.studentNo);
    if (existing && (existing.rollNo !== student.rollNo || existing.name !== student.name)) {
      throw new Error("พบรหัสนักเรียนซ้ำแต่ข้อมูลไม่ตรงกันในไฟล์ต้นทาง กรุณาใช้ไฟล์ Excel ด้วยตนเอง");
    }
    unique.set(student.studentNo, student);
  }
  const students = [...unique.values()].sort((a, b) => Number(a.rollNo) - Number(b.rollNo));
  if (!students.length) throw new Error(`ไม่พบรายชื่อห้อง ${requestedClass} ในไฟล์ต้นทาง`);
  if (students.length > MAX_STUDENTS) throw new Error(`ห้องนี้มี ${students.length} รายชื่อ เกินขีดจำกัด ${MAX_STUDENTS} คนต่อครั้ง`);
  const duplicateRoll = students.some((student, index) => students.findIndex((item) => item.rollNo === student.rollNo) !== index);
  if (duplicateRoll) throw new Error("พบเลขที่นักเรียนซ้ำในห้องจากไฟล์ต้นทาง กรุณาตรวจสอบก่อนนำเข้า");
  return students;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId")?.trim();
  if (!classId || classId.length > 100) return NextResponse.json({ error: "กรุณาเลือกห้องเรียน" }, { status: 400 });

  const classroom = await prisma.class.findFirst({
    where: { id: classId, ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  try {
    const sourceUrl = await resolveSourceWorkbookUrl();
    const response = await fetch(sourceUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream" },
    });
    if (!response.ok) {
      return NextResponse.json({ error: `เว็บไซต์โรงเรียนตอบกลับ HTTP ${response.status} กรุณาลองใหม่หรือใช้ Excel ด้วยตนเอง` }, { status: 502 });
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "ไฟล์รายชื่อจากโรงเรียนมีขนาดใหญ่เกินกำหนด" }, { status: 502 });
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_FILE_BYTES || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return NextResponse.json({ error: "ไฟล์จากเว็บไซต์โรงเรียนไม่ใช่ Excel ที่อ่านได้ หรือมีขนาดเกินกำหนด" }, { status: 502 });
    }

    const students = parseRoster(bytes, classroom.name);
    return NextResponse.json({
      ok: true,
      classId: classroom.id,
      className: classroom.name,
      students,
      sourceLastModified: response.headers.get("last-modified"),
      source: "MKS school roster",\n      sourceUrl,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถอ่านไฟล์รายชื่อนักเรียนได้";
    return NextResponse.json({
      error: message.includes("fetch failed") || message.includes("timed out")
        ? "เชื่อมต่อเว็บไซต์โรงเรียนไม่สำเร็จ กรุณาลองใหม่หรือใช้ Excel ด้วยตนเอง"
        : message,
    }, { status: 502 });
  }
}
