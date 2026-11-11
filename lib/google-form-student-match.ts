import { compareByRollNo } from "./student-sort";

export type FormStudentCandidate = {
  id: string;
  rollNo: string;
  studentNo: string;
  name: string;
  classId: string;
  className: string;
};

const normalized = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");

export function normalizeFormRoom(value: string) {
  const text = normalized(value).replace(/^(?:ห้อง|ชั้น|มัธยมศึกษาปีที่|มัธยมศึกษา|ม\.?)*/u, "");
  const match = text.match(/(\d+)\s*[/.-]\s*(\d+)/u);
  return match ? `${Number(match[1])}/${Number(match[2])}` : text.replace(/[.-]/g, "/");
}

export function matchFormStudent(students: FormStudentCandidate[], rollNo: string, room: string, name: string) {
  const nameKey = normalized(name);
  const rollKey = normalized(rollNo);
  const roomKey = normalizeFormRoom(room);
  const byName = nameKey ? students.filter((student) => normalized(student.name) === nameKey) : [];
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    let candidates = byName;
    if (roomKey) candidates = candidates.filter((student) => normalizeFormRoom(student.className) === roomKey);
    if (candidates.length > 1 && rollKey) candidates = candidates.filter((student) => normalized(student.rollNo) === rollKey || normalized(student.studentNo) === rollKey);
    if (candidates.length === 1) return candidates[0];
    return null;
  }
  if (!rollKey) return null;
  let candidates = students.filter((student) => normalized(student.rollNo) === rollKey || normalized(student.studentNo) === rollKey);
  if (roomKey) candidates = candidates.filter((student) => normalizeFormRoom(student.className) === roomKey);
  return candidates.length === 1 ? candidates[0] : null;
}

export function compareFormStudents(
  a: Pick<FormStudentCandidate, "rollNo" | "studentNo" | "name" | "className">,
  b: Pick<FormStudentCandidate, "rollNo" | "studentNo" | "name" | "className">,
) {
  return normalizeFormRoom(a.className).localeCompare(normalizeFormRoom(b.className), "th", { numeric: true })
    || compareByRollNo(a, b);
}
