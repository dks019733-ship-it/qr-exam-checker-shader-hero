import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ImportScore = { columnId: string; score: number };
type ImportRow = { room?: string; studentNo?: string; rollNo?: string; name?: string; scores?: ImportScore[] };
const normalize = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");
const normalizeRoom = (value: string) => {
  const text = normalize(value).replace(/^(?:ห้อง|ชั้น|มัธยมศึกษาปีที่|มัธยมศึกษา|ม\.?)*/u, "");
  const match = text.match(/(\d+)\s*[/.-]\s*(\d+)/u);
  return match ? `${Number(match[1])}/${Number(match[2])}` : text.replace(/[.-]/g, "/");
};
const normalizeRoll = (value: string) => {
  const text = normalize(value);
  return /^\d+$/u.test(text) ? String(Number(text)) : text;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId : "";
  const rows = Array.isArray(body?.rows) ? body.rows as ImportRow[] : [];
  if (!classId || !rows.length || rows.length > 1000) {
    return NextResponse.json({ error: "เลือกห้องเรียนและนำเข้าข้อมูลไม่เกิน 1,000 แถวต่อครั้ง" }, { status: 400 });
  }

  const classroom = await prisma.class.findFirst({ where: { id: classId, ownerId: session.user.id }, select: { id: true, name: true } });
  if (!classroom) return NextResponse.json({ error: "ไม่พบห้องเรียนหรือไม่มีสิทธิ์" }, { status: 404 });

  const columnIds = [...new Set(rows.flatMap((row) => Array.isArray(row?.scores) ? row.scores.map((score) => score.columnId) : []))];
  if (!columnIds.length || columnIds.length > 40) return NextResponse.json({ error: "ไม่พบคอลัมน์คะแนนที่ตรงกับงาน/บทในสมุดคะแนน" }, { status: 400 });
  const [columns, students] = await Promise.all([
    prisma.gradeColumn.findMany({ where: { ownerId: session.user.id, classId, id: { in: columnIds } }, select: { id: true } }),
    prisma.student.findMany({ where: { classId, isActive: true }, select: { id: true, studentNo: true, rollNo: true, name: true } }),
  ]);
  if (columns.length !== columnIds.length) return NextResponse.json({ error: "มีช่องคะแนนที่ไม่อยู่ในห้องเรียนนี้ กรุณาโหลดสมุดคะแนนใหม่" }, { status: 400 });
  const validColumnIds = new Set(columns.map((column) => column.id));
  const writes = new Map<string, { columnId: string; studentId: string; score: number }>();
  const matchedStudents = new Set<string>();
  let unmatchedRows = 0;
  let invalidScores = 0;
  let roomMismatches = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") { unmatchedRows++; continue; }
    const studentNo = typeof row.studentNo === "string" ? row.studentNo.trim() : "";
    const rollNo = typeof row.rollNo === "string" ? row.rollNo.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const room = typeof row.room === "string" ? row.room.trim() : "";
    if (room && normalizeRoom(room) !== normalizeRoom(classroom.name)) { roomMismatches++; continue; }
    let candidates = studentNo ? students.filter((student) => normalize(student.studentNo) === normalize(studentNo)) : [];
    if (candidates.length !== 1 && rollNo) {
      candidates = students.filter((student) => normalizeRoll(student.rollNo) === normalizeRoll(rollNo));
      if (candidates.length > 1 && name) candidates = candidates.filter((student) => normalize(student.name) === normalize(name));
    }
    if (!candidates.length && name) candidates = students.filter((student) => normalize(student.name) === normalize(name));
    if (candidates.length !== 1) { unmatchedRows++; continue; }
    const student = candidates[0];
    let rowHasScore = false;
    for (const entry of Array.isArray(row.scores) ? row.scores : []) {
      if (!entry || !validColumnIds.has(entry.columnId)) continue;
      if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) { invalidScores++; continue; }
      rowHasScore = true;
      writes.set(`${entry.columnId}:${student.id}`, { columnId: entry.columnId, studentId: student.id, score: entry.score });
    }
    if (rowHasScore) matchedStudents.add(student.id);
    else unmatchedRows++;
  }

  const operations = [...writes.values()].map((entry) => prisma.gradeScore.upsert({
    where: { columnId_studentId: { columnId: entry.columnId, studentId: entry.studentId } },
    create: entry,
    update: { score: entry.score },
  }));
  for (let index = 0; index < operations.length; index += 250) {
    await prisma.$transaction(operations.slice(index, index + 250));
  }
  return NextResponse.json({ importedScores: writes.size, matchedStudents: matchedStudents.size, unmatchedRows, invalidScores, roomMismatches });
}
