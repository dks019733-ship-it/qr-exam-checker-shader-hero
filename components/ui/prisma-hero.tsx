"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRef } from "react";

interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: React.CSSProperties;
}

export const WordsPullUp = ({ text, className = "", showAsterisk = false, style }: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(" ");

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span key={i} initial={{ y: 20, opacity: 0 }} animate={isInView ? { y: 0, opacity: 1 } : {}} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} className="relative inline-block" style={{ marginRight: isLast ? 0 : "0.25em" }}>
            {word}{showAsterisk && isLast && <span className="absolute -right-[0.3em] top-[0.65em] text-[0.31em]">*</span>}
          </motion.span>
        );
      })}
    </div>
  );
};

export const PrismaHero = () => {
  return (
    <section className="min-h-[680px] w-full p-2 sm:p-3">
      <div className="relative min-h-[676px] overflow-hidden rounded-[1.75rem] bg-neutral-950">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
        />
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/80" />

        <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-b-2xl bg-black/80 px-4 py-2.5 backdrop-blur sm:gap-8 sm:px-7">
            {["ภาพรวม", "นักเรียน", "ข้อสอบ", "ตรวจข้อสอบ", "รายงาน"].map((item) => (
              <a key={item} href="/dashboard" className="text-[11px] text-white/70 transition hover:text-white sm:text-xs">{item}</a>
            ))}
          </div>
        </nav>

        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 sm:px-8 md:px-12 md:pb-12">
          <div className="grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="mb-5 flex items-center gap-2 text-xs text-white/70">
                <CheckCircle2 className="h-4 w-4" /> Secure exam workflow
              </div>
              <h1 className="text-[18vw] font-medium leading-[0.8] tracking-[-0.075em] text-white sm:text-[15vw] lg:text-[12vw]">
                <WordsPullUp text="QR Exam" showAsterisk />
              </h1>
            </div>
            <div className="lg:col-span-4">
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .8, delay: .4 }} className="max-w-md text-sm leading-6 text-white/75 sm:text-base">
                ระบบตรวจข้อสอบสำหรับครูที่เชื่อม Google Drive ของตัวเอง จัดการนักเรียน สร้าง QR อ่านใบคำตอบ และให้ครูยืนยันคะแนนก่อนบันทึกผล
              </motion.p>
              <motion.a initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .8, delay: .6 }} href="/dashboard" className="group mt-6 inline-flex items-center gap-3 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:gap-4">
                เข้าสู่ระบบ
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black"><ArrowRight className="h-4 w-4 text-white" /></span>
              </motion.a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
