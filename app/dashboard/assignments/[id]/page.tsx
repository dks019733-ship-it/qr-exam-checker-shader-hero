import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AssignmentSubmissionReview } from "@/components/assignment-submission-review";

export default async function AssignmentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { id } = await params;
  if (!id) notFound();
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 lg:px-8">
        <Link href="/dashboard/assignments" className="text-xs font-semibold text-[#4d5f4a] hover:underline">← กลับไปหน้ามอบหมายงาน</Link>
      </div>
      <AssignmentSubmissionReview assignmentId={id} />
    </div>
  );
}
