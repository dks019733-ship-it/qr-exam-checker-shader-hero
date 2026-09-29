import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnswerEntry } from "@/components/answer-entry";

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <AnswerEntry />;
}
