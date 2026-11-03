import { prisma } from "@/lib/prisma";

type SourceColumn = {
  id: string;
  ownerId: string;
  classId: string;
  title: string;
  period: "MIDTERM" | "AFTER_MIDTERM" | "BEFORE_MIDTERM";
  maxScore: number;
};

export async function getFormScoreDestination(source: SourceColumn, classId: string) {
  if (classId === source.classId) return source.id;
  const destination = await prisma.gradeColumn.upsert({
    where: { sourceColumnId_classId: { sourceColumnId: source.id, classId } },
    create: {
      ownerId: source.ownerId,
      classId,
      title: source.title,
      period: source.period,
      maxScore: source.maxScore,
      sourceColumnId: source.id,
    },
    update: { maxScore: source.maxScore },
    select: { id: true },
  });
  return destination.id;
}

export async function getFormScoreColumnIds(sourceColumnId: string) {
  const columns = await prisma.gradeColumn.findMany({
    where: { OR: [{ id: sourceColumnId }, { sourceColumnId }] },
    select: { id: true },
  });
  return columns.map((column) => column.id);
}

export async function getOtherFormScoreColumnIds(sourceColumnId: string, destinationColumnId: string) {
  return (await getFormScoreColumnIds(sourceColumnId)).filter((id) => id !== destinationColumnId);
}
