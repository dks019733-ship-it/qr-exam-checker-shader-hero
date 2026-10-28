import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "งานของครู",
  description: "พื้นที่รวมเครื่องมือช่วยงานสอน ห้องเรียน ข้อสอบ คะแนน และผู้ช่วย AI"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
