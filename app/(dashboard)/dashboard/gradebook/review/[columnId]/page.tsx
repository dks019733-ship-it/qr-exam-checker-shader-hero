import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GoogleFormReview } from "@/components/google-form-review";

export default async function GoogleFormReviewPage({ params }: { params: Promise<{ columnId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { columnId } = await params;
  return <GoogleFormReview columnId={columnId} />;
}
