import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Gradebook } from "@/components/gradebook";

export default async function GradebookPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <Gradebook />;
}
