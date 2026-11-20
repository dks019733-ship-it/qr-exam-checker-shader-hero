"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";

type Student = { id: string; qrToken: string; name: string; studentNo: string; rollNo: string };
type BarcodeResult = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;
type BarcodeWindow = Window & { BarcodeDetector?: BarcodeDetectorConstructor };

type Props = {
  students: Student[];
  onStudentDetected: (studentId: string) => void;
  resumeSignal: number;
};

const QR_PREFIX = "QEC1:";

export function StudentQrScanner({ students, onStudentDetected, resumeSignal }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const studentsRef = useRef(students);
  const onDetectedRef = useRef(onStudentDetected);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("เปิดกล้องเพื่ออ่าน QR บนกระดาษคำตอบ");

  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { onDetectedRef.current = onStudentDetected; }, [onStudentDetected]);

  const stopCamera = useCallback(() => {
    activeRef.current = false;
    pausedRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setWaitingForNext(false);
  }, []);

  const scanFrame = useCallback(async () => {
    if (!activeRef.current || pausedRef.current || !detectorRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const results = await detectorRef.current.detect(video);
        for (const result of results) {
          const payload = result.rawValue.trim();
          if (!payload.startsWith(QR_PREFIX)) continue;
          const token = payload.slice(QR_PREFIX.length).trim();
          if (!token) continue;
          const student = studentsRef.current.find((item) => item.qrToken === token);
          if (!student) {
            setError("QR นี้ไม่ตรงกับรายชื่อนักเรียนในห้องของข้อสอบที่เลือก");
            continue;
          }
          pausedRef.current = true;
          setWaitingForNext(true);
          setError("");
          setNotice("อ่าน QR สำเร็จ: เลขที่ " + student.rollNo + " · " + student.name);
          onDetectedRef.current(student.id);
          break;
        }
      } catch {
        // Camera frames can be temporarily unreadable while autofocus adjusts.
      }
    }
    if (activeRef.current && !pausedRef.current) {
      timerRef.current = window.setTimeout(() => { void scanFrame(); }, 300);
    }
  }, []);

  async function startCamera() {
    setError("");
    const Detector = (window as BarcodeWindow).BarcodeDetector;
    if (!Detector) {
      setError("เบราว์เซอร์นี้ยังไม่มีตัวอ่าน QR ผ่านกล้องในตัว แนะนำให้เปิดหน้านี้ด้วย Chrome หรือ Edge เวอร์ชันล่าสุด หรือเลือกนักเรียนจากรายการแทน");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("อุปกรณ์หรือเบราว์เซอร์นี้ไม่อนุญาตให้เปิดกล้อง");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play();
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      activeRef.current = true;
      pausedRef.current = false;
      setCameraOpen(true);
      setWaitingForNext(false);
      setNotice("กำลังค้นหา QR ของนักเรียน · ถือกล้องให้เห็น QR ชัดเจน");
      void scanFrame();
    } catch (cameraError) {
      stopCamera();
      const name = cameraError instanceof Error ? cameraError.name : "";
      setError(name === "NotAllowedError"
        ? "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาต Camera ในการตั้งค่าเบราว์เซอร์"
        : "เปิดกล้องไม่สำเร็จ ตรวจสอบว่ากล้องไม่ได้ถูกใช้งานโดยแอปอื่น และเปิดผ่าน HTTPS");
    }
  }

  function scanNext() {
    if (!cameraOpen) return;
    pausedRef.current = false;
    setWaitingForNext(false);
    setError("");
    setNotice("กำลังค้นหา QR ของนักเรียนคนถัดไป");
    void scanFrame();
  }

  useEffect(() => {
    if (resumeSignal > 0 && cameraOpen && waitingForNext) scanNext();
    // resumeSignal is an event counter from the parent after a successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSignal]);

  useEffect(() => () => {
    activeRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return (
    <section className="mt-5 rounded-2xl border border-[#dce8df] bg-[#f8fbf8] p-4 sm:p-5" aria-label="สแกน QR นักเรียน">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#203e2d]"><ScanLine className="h-4 w-4" />สแกน QR จากกระดาษคำตอบ</h2>
          <p className="mt-1 text-xs leading-5 text-[#718276]">QR ใช้ระบุตัวนักเรียนเท่านั้น จากนั้นตรวจคำตอบบนกระดาษและเลือกคำตอบด้านล่างก่อนบันทึก</p>
        </div>
        {!cameraOpen ? (
          <button type="button" onClick={() => void startCamera()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d4b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173d2b]">
            <Camera className="h-4 w-4" />เปิดกล้องสแกน
          </button>
        ) : (
          <button type="button" onClick={stopCamera} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d6dfd7] bg-white px-4 py-2 text-sm font-semibold text-[#536b5b] hover:bg-[#f1f5f1]">
            <CameraOff className="h-4 w-4" />ปิดกล้อง
          </button>
        )}
      </div>
      {cameraOpen && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#d6dfd7] bg-black">
          <video ref={videoRef} muted playsInline autoPlay className="max-h-[420px] min-h-[220px] w-full object-contain" aria-label="ภาพจากกล้องสำหรับอ่าน QR" />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-[#536b5b]">{notice}</p>
        {waitingForNext && <button type="button" onClick={scanNext} className="min-h-9 rounded-lg border border-[#cbd9ce] bg-white px-3 text-xs font-semibold text-[#1d4b35]">สแกนคนถัดไป</button>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{error}</p>}
      <p className="mt-3 text-[11px] leading-5 text-[#89958b]">หมายเหตุ: รุ่นนี้อ่าน QR เพื่อจับคู่นักเรียนและเปิดกล้องต่อเนื่องได้ แต่ยังไม่อ่านวงกลมคำตอบ (OMR) อัตโนมัติ ระบบจะไม่เดาคำตอบแทนผู้ตรวจ</p>
    </section>
  );
}
