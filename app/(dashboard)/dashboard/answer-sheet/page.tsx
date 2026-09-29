import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnswerSheetEditor } from "@/components/answer-sheet-editor";

export default async function AnswerSheetPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <AnswerSheetEditor />;
}
