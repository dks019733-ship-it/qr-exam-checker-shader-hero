import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClassroomManager } from "@/components/classroom-manager";

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <ClassroomManager />;
}
