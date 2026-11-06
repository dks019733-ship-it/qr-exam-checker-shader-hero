"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const DEFAULT_MESSAGE = "อัปเดตระบบแล้ว · ตรวจคำตอบ Google Forms แยกห้อง พร้อมตรวจคะแนนรายข้อแบบเรียลไทม์";

type Announcement = { active: boolean; message: string };

export function SiteAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement>({
    active: true,
    message: DEFAULT_MESSAGE,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/site-announcement", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as Announcement;
      if (typeof data.active === "boolean" && typeof data.message === "string") {
        setAnnouncement({ active: data.active, message: data.message });
      }
    } catch {
      // Keep the last known message visible when the network is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  if (!announcement.active) return null;

  return (
    <div className="sticky top-2 z-50 mx-auto mt-2 w-fit max-w-[calc(100%-1rem)] rounded-full border border-white/20 bg-[#2d3a2b]/80 px-4 py-2 text-center text-xs font-medium tracking-wide text-[#e2ecdf] shadow-lg shadow-[#2d3a2b]/15 backdrop-blur-xl sm:top-3 sm:px-5">
      <span className="inline-flex items-center justify-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b7d2af] opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#b7d2af]" />
        </span>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#b7d2af]" aria-hidden="true" />
        <span>{announcement.message}</span>
      </span>
    </div>
  );
}
