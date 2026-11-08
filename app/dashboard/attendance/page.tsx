import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AttendanceManager } from "@/components/attendance-manager";

export const metadata = { title: "เช็กชื่อเข้าเรียน | งานของครู" };

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <AttendanceManager />;
}
