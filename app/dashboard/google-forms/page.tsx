import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GoogleFormsManager } from "@/components/google-forms-manager";
import { FeatureAvailabilityGate } from "@/components/feature-availability-gate";

export default async function GoogleFormsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <FeatureAvailabilityGate feature="ai"><GoogleFormsManager /></FeatureAvailabilityGate>;
}
