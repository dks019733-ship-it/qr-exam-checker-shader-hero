import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "งานของครู | พื้นที่รวมเครื่องมือช่วยงานสอน",
  description: "จัดการชั้นเรียน ข้อสอบ สมุดคะแนน และเครื่องมือ AI สำหรับครูในที่เดียว"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
