import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GoogleFormsManager } from "@/components/google-forms-manager";

export default async function GoogleFormsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <GoogleFormsManager />;
}
