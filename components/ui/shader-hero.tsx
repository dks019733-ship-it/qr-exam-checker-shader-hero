"use client";

import { useEffect, useRef, useState } from "react";
import { MeshGradient, PulsingBorder } from "@paper-design/shaders-react";
import { motion } from "framer-motion";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export default function ShaderHero({ navigation, login, actions }: { navigation: ReactNode; login: ReactNode; actions: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setIsActive] = useState(false);

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true);
    const handleMouseLeave = () => setIsActive(false);

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative flex min-h-[680px] w-full flex-col overflow-hidden rounded-[1.75rem] bg-[#eef1ed] text-slate-900 sm:block">
      <svg className="absolute inset-0 h-0 w-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
          <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={["#f4f5f1", "#dfe6e1", "#cbd8d1", "#e4e9e5", "#d9e3e1"]}
        speed={0.3}
      />
      <MeshGradient
        className="absolute inset-0 h-full w-full opacity-25"
        colors={["#ffffff", "#e7ece8", "#cbd8d1", "#dce5e2"]}
        speed={0.2}
      />

      <header className="relative z-20 flex w-full items-center gap-2 px-3 py-4 sm:justify-between sm:p-6">
        <Link href="/" className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 sm:flex-none">
          <motion.div
            whileHover={{ scale: 1.08, rotate: [0, -4, 4, 0] }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-700 sm:h-10 sm:w-10"
            style={{ filter: "url(#logo-glow)" }}
          >
            <ScanLine className="h-7 w-7" />
          </motion.div>
          <span className="truncate text-sm font-semibold tracking-wide text-slate-800">QR Exam Checker</span>
        </Link>

        {navigation}
        {login}
      </header>

      <main className="relative z-20 mt-auto max-w-2xl px-5 pb-8 pt-16 sm:absolute sm:bottom-8 sm:left-8 sm:mt-0 sm:p-0">
        <div className="text-left">
          <motion.div
            className="relative mb-5 inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white/75 px-4 py-2 shadow-sm backdrop-blur-sm sm:mb-6"
            style={{ filter: "url(#glass-effect)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="absolute left-1 right-1 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-emerald-700/20 to-transparent" />
            <span className="relative z-10 text-xs font-medium tracking-wide text-slate-700 sm:text-sm">
              ✨ ระบบตรวจข้อสอบด้วย QR Code
            </span>
          </motion.div>

          <motion.h1
            className="mb-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:mb-6 sm:text-6xl sm:leading-none md:text-7xl lg:text-8xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.span
              className="mb-2 block text-xl font-medium tracking-[0.12em] text-slate-600 sm:text-4xl sm:font-light sm:tracking-wider md:text-5xl lg:text-6xl"
              style={{
                background: "linear-gradient(135deg, #475569 0%, #4d7568 48%, #64748b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "url(#text-glow)",
              }}
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              QR EXAM CHECKER
            </motion.span>
            <span className="block font-black text-slate-900">ตรวจข้อสอบ</span>
            <span className="block font-light italic text-slate-600">ให้เป็นระบบ</span>
          </motion.h1>

          <motion.p
            className="mb-6 max-w-xl text-base leading-relaxed text-slate-600 sm:mb-8 sm:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            สร้างข้อสอบ จัดการนักเรียน สร้างกระดาษคำตอบพร้อม QR และเก็บไฟล์บน Google Drive
            ของครูเอง ในระบบเดียว
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            {actions}
          </motion.div>
        </div>
      </main>

      <div className="absolute bottom-8 right-8 z-10 hidden sm:block">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <PulsingBorder
            colors={["#64748b", "#4d7568", "#a8b9af", "#d8dfda", "#ffffff"]}
            colorBack="#00000000"
            speed={1.5}
            roundness={1}
            thickness={0.1}
            softness={0.2}
            intensity={5}
            spots={5}
            spotSize={0.1}
            pulse={0.1}
            smoke={0.5}
            smokeSize={4}
            scale={0.65}
            rotation={0}
            style={{ width: "60px", height: "60px", borderRadius: "50%" }}
          />
          <motion.svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            style={{ transform: "scale(1.6)" }}
          >
            <defs>
              <path id="hero-circle" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
            </defs>
            <text className="fill-white/80 text-sm font-medium">
              <textPath href="#hero-circle" startOffset="0%">
                QR EXAM CHECKER • ตรวจข้อสอบอัตโนมัติ • QR EXAM CHECKER •
              </textPath>
            </text>
          </motion.svg>
        </div>
      </div>
    </div>
  );
}
