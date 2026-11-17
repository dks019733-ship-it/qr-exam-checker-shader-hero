"use client";

import { redirect } from "next/navigation";

export default function ReportsPage() {
  redirect("/dashboard/exams?tab=scores");
}
