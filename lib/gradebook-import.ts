import { prisma } from "@/lib/prisma";

const normalized = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, "").toLocaleLowerCase("th-TH");

export async function reconcilePendingFormScores(classId: string) {
  const [students, pending] = await Promise.all([
    prisma.student.findMany({ where: { classId, isActive: true }, select: { id: true, rollNo: true, studentNo: true, name: true } }),
    prisma.pendingFormScore.findMany({ where: { column: { classId } }, orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }] }),
  ]);
  const roster = students.map((student) => ({
    ...student,
    nameKey: normalized(student.name),
    rolls: [normalized(student.rollNo), normalized(student.studentNo)].filter(Boolean),
  }));
  const matches = new Map<string, { columnId: string; studentId: string; score: number; pendingIds: string[] }>();

  for (const row of pending) {
    const nameKey = normalized(row.studentName);
    const rollKey = normalized(row.rollNo);
    const candidates = roster.filter((student) => student.nameKey === nameKey && (!rollKey || student.rolls.includes(rollKey)));
    if (candidates.length !== 1) continue;
    const student = candidates[0];
    const key = `${row.columnId}:${student.id}`;
    const previous = matches.get(key);
    matches.set(key, { columnId: row.columnId, studentId: student.id, score: row.score, pendingIds: [...(previous?.pendingIds || []), row.id] });
  }

  const resolvedIds: string[] = [];
  for (const match of matches.values()) {
    await prisma.gradeScore.upsert({
      where: { columnId_studentId: { columnId: match.columnId, studentId: match.studentId } },
      create: { columnId: match.columnId, studentId: match.studentId, score: match.score },
      update: { score: match.score },
    });
    resolvedIds.push(...match.pendingIds);
  }
  if (resolvedIds.length) await prisma.pendingFormScore.deleteMany({ where: { id: { in: [...new Set(resolvedIds)] } } });
  return { matched: matches.size, pending: pending.length - resolvedIds.length };
}
