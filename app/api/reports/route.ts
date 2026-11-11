import { featureAvailabilityResponse } from "@/lib/feature-availability";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const unavailable = await featureAvailabilityResponse("gradebook");
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exams = await prisma.exam.findMany({
    where: { ownerId: session.user.id },
    include: {
      class: { select: { id: true, name: true } },
      attempts: { include: { student: { select: { id: true, rollNo: true, studentNo: true, name: true } } }, orderBy: { updatedAt: "desc" } },
      _count: { select: { questions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const sortedExams = exams.map((exam) => ({
    ...exam,
    attempts: [...exam.attempts].sort((a, b) =>
      (a.student.rollNo || "").localeCompare(b.student.rollNo || "", "th", { numeric: true }) ||
      a.student.studentNo.localeCompare(b.student.studentNo, "th", { numeric: true }),
    ),
  }));
  return NextResponse.json(sortedExams);
}
