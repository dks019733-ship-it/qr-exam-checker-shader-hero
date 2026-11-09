import { FeatureAvailabilityGate } from "@/components/feature-availability-gate";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScoreReport } from "@/components/score-report";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <FeatureAvailabilityGate feature="gradebook"><ScoreReport /></FeatureAvailabilityGate>;
}
