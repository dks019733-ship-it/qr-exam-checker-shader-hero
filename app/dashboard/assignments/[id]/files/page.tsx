import { FeatureAvailabilityGate } from "@/components/feature-availability-gate";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AssignmentFilesEditor } from "@/components/assignment-files-editor";

export default async function AssignmentFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { id } = await params;
  if (!id) notFound();
  return (
    <FeatureAvailabilityGate feature="assignments">
      <main className="min-h-screen bg-[#f8f7f4] px-4 py-8 text-[#1c241b] sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Link href={"/dashboard/assignments/" + id} className="text-xs font-semibold text-[#4d5f4a] hover:underline">← กลับหน้าตรวจงาน</Link>
          <AssignmentFilesEditor assignmentId={id} />
        </div>
      </main>
    </FeatureAvailabilityGate>
  );
}
