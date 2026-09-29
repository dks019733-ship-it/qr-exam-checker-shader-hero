import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PrintClassSheets } from "@/components/print-class-sheets";

export default async function PrintAnswerSheetPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />กำลังโหลด...</div>}>
      <PrintClassSheets />
    </Suspense>
  );
}
