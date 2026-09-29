import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Exam Checker",
  description: "ตรวจข้อสอบด้วย QR และใบคำตอบอย่างเป็นระบบ"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
