import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TeacherAiProfileEditor } from "@/components/ai-chat/TeacherAiProfileEditor";

export default async function TeacherAiProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <TeacherAiProfileEditor />;
}
