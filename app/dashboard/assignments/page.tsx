import { FeatureAvailabilityGate } from "@/components/feature-availability-gate";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AssignmentManager } from "@/components/assignment-manager";

export const metadata = { title: "มอบหมายงาน | งานของครู" };

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <FeatureAvailabilityGate feature="assignments"><AssignmentManager /></FeatureAvailabilityGate>;
}
