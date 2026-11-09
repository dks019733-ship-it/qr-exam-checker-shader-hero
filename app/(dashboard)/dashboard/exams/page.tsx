import { FeatureAvailabilityGate } from "@/components/feature-availability-gate";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExamManager } from "@/components/exam-manager";

export default async function ExamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <FeatureAvailabilityGate feature="exams"><ExamManager /></FeatureAvailabilityGate>;
}
