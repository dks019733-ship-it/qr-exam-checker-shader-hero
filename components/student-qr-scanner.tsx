"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine, ScanSearch } from "lucide-react";
import { readOmrImage, type OmrIssue } from "@/lib/omr-reader";

type Student = { id: string; qrToken: string; name: string; studentNo: string; rollNo: string };
type BarcodeResult = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;
type BarcodeWindow = Window & { BarcodeDetector?: BarcodeDetectorConstructor };

type Props = {
  students: Student[];
  onStudentDetected: (studentId: string) => void;
  resumeSignal: number;
  questionCount: number;
  choiceKeys: string[];
  onAnswersDetected: (answers: Record<string, string>, issues: OmrIssue[]) => void;
};

const QR_PREFIX = "QEC1:";

export function StudentQrScanner({ students, onStudentDetected, resumeSignal, questionCount, choiceKeys, onAnswersDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const startingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const studentsRef = useRef(students);
  const onDetectedRef = useRef(onStudentDetected);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("เปิดกล้องเพื่ออ่าน QR และคำตอบบนกระดาษ");
  const [omrBusy, setOmrBusy] = useState(false);
  const [omrSummary, setOmrSummary] = useState<{ recognizedCount: number; questionCount: number; issues: OmrIssue[] } | null>(null);

  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { onDetectedRef.current = onStudentDetected; }, [onStudentDetected]);

  const stopCamera = useCallback(() => {
    activeRef.current = false;
    pausedRef.current = false;
    startingRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraStarting(false);
    setWaitingForNext(false);
  }, []);

  const scanFrame = useCallback(async () => {
    if (!activeRef.current || pausedRef.current || !detectorRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
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
        // A frame may be temporarily unreadable while autofocus adjusts.
      }
    }

    if (activeRef.current && !pausedRef.current) {
      timerRef.current = window.setTimeout(() => { void scanFrame(); }, 250);
    }
  }, []);

  async function startCamera() {
    if (startingRef.current || cameraOpen) return;

    setError("");
    const Detector = (window as BarcodeWindow).BarcodeDetector;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("การใช้กล้องต้องเปิดเว็บไซต์ผ่าน HTTPS และใช้เบราว์เซอร์ที่อนุญาตการเข้าถึงกล้อง");
      return;
    }

    startingRef.current = true;
    setCameraStarting(true);
    try {
      // Create the detector before requesting camera permission so unsupported
      // QR formats fail without leaving a camera stream running.
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("VIDEO_ELEMENT_NOT_READY");

      video.srcObject = stream;
      setCameraOpen(true);

      // Let React reveal the video container before starting playback. This
      // avoids scanning a video element that is still inside display:none.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await video.play();

      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("CAMERA_METADATA_TIMEOUT")), 10000);
          const onReady = () => {
            window.clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onReady);
            resolve();
          };
          video.addEventListener("loadedmetadata", onReady, { once: true });
        });
      }

      detectorRef.current = detector;
      activeRef.current = true;
      pausedRef.current = false;
      setWaitingForNext(false);
      setNotice(detector ? "กำลังค้นหา QR ของนักเรียน · ถือกล้องให้เห็น QR ชัดเจน" : "เบราว์เซอร์นี้อ่าน QR อัตโนมัติไม่ได้ กรุณาเลือกนักเรียนจากรายการ แล้วใช้ปุ่มอ่านคำตอบ OMR");

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack?.addEventListener("ended", () => {
        if (!activeRef.current) return;
        stopCamera();
        setError("กล้องหยุดทำงานหรือถูกปิด กรุณาเปิดกล้องอีกครั้ง");
      }, { once: true });

      if (detector) void scanFrame();
    } catch (cameraError) {
      stopCamera();
      const name = cameraError instanceof Error ? cameraError.name : "";
      setError(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาต Camera ในการตั้งค่าเบราว์เซอร์"
        : name === "NotFoundError"
          ? "ไม่พบกล้องบนอุปกรณ์นี้"
          : name === "NotReadableError"
            ? "กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปที่ใช้กล้องแล้วลองใหม่"
            : "เปิดกล้องไม่สำเร็จ ตรวจสอบสิทธิ์การใช้กล้องและลองเปิดหน้าเว็บผ่าน HTTPS");
    } finally {
      startingRef.current = false;
      setCameraStarting(false);
    }
  }

  async function scanAnswers() {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || omrBusy) {
      setError("กล้องยังจับภาพไม่พร้อม กรุณารอสักครู่แล้วลองใหม่");
      return;
    }
    setOmrBusy(true);
    setError("");
    setOmrSummary(null);
    try {
      const result = await readOmrImage(video, questionCount, choiceKeys);
      onAnswersDetected(result.answers, result.issues);
      setOmrSummary({
        recognizedCount: result.recognizedCount,
        questionCount: result.questionCount,
        issues: result.issues,
      });
      setNotice("อ่านคำตอบได้ " + result.recognizedCount + " จาก " + result.questionCount + " ข้อ · ตรวจทานข้อที่แจ้งเตือนก่อนบันทึก");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "อ่านคำตอบจากภาพไม่สำเร็จ");
    } finally {
      setOmrBusy(false);
    }
  }

  function scanNext() {
    if (!cameraOpen || !activeRef.current) return;
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
          <p className="mt-1 text-xs leading-5 text-[#718276]">อ่าน QR เพื่อระบุตัวนักเรียน และอ่านวงกลมคำตอบจากกระดาษ OMR V1 จากนั้นครูตรวจทานก่อนบันทึก</p>
        </div>
        {!cameraOpen ? (
          <button type="button" disabled={cameraStarting} onClick={() => void startCamera()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d4b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173d2b] disabled:cursor-wait disabled:opacity-60">
            <Camera className="h-4 w-4" />{cameraStarting ? "กำลังเปิดกล้อง..." : "เปิดกล้องสแกน"}
          </button>
        ) : (
          <button type="button" onClick={stopCamera} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d6dfd7] bg-white px-4 py-2 text-sm font-semibold text-[#536b5b] hover:bg-[#f1f5f1]">
            <CameraOff className="h-4 w-4" />ปิดกล้อง
          </button>
        )}
      </div>
      <div className={cameraOpen ? "mt-4 overflow-hidden rounded-xl border border-[#d6dfd7] bg-black" : "hidden"}>
        <video ref={videoRef} muted playsInline autoPlay className="max-h-[420px] min-h-[220px] w-full object-contain" aria-label="ภาพจากกล้องสำหรับอ่าน QR" />
      </div>
      {cameraOpen && <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void scanAnswers()} disabled={omrBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d4b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173d2b] disabled:opacity-60"><ScanSearch className="h-4 w-4" />{omrBusy ? "กำลังอ่านวงกลม..." : "อ่านคำตอบจากภาพ"}</button><span className="text-[11px] text-[#718276]">ใช้กับกระดาษ OMR FORM V1 ที่พิมพ์จากระบบ</span></div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-[#536b5b]">{notice}</p>
        {waitingForNext && <button type="button" onClick={scanNext} className="min-h-9 rounded-lg border border-[#cbd9ce] bg-white px-3 text-xs font-semibold text-[#1d4b35]">สแกนคนถัดไป</button>}
      </div>
      {omrSummary && <div className="mt-3 rounded-lg border border-[#d6dfd7] bg-white p-3 text-xs"><p className="font-semibold text-[#203e2d]">ผลการอ่าน: {omrSummary.recognizedCount}/{omrSummary.questionCount} ข้อ</p>{omrSummary.issues.length > 0 ? <p className="mt-1 leading-5 text-amber-800">ต้องตรวจทานข้อ: {omrSummary.issues.map((issue) => issue.question + (issue.reason === "MULTIPLE_MARKS" ? " (ฝนหลายตัวเลือก)" : " (รอยฝนไม่ชัด)")).join(", ")}</p> : <p className="mt-1 text-emerald-700">ไม่พบข้อที่ต้องแจ้งเตือน กรุณาตรวจทานคำตอบทั้งหมดอีกครั้ง</p>}<p className="mt-1 text-[#718276]">ระบบจะไม่เลือกคำตอบแทนในข้อที่อ่านไม่ชัดหรือฝนหลายตัวเลือก</p></div>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{error}</p>}
      <p className="mt-3 text-[11px] leading-5 text-[#89958b]">หมายเหตุ: OMR ใช้จุดอ้างอิง 4 มุมเพื่อปรับภาพก่อนอ่านวงกลม ระบบจะแยกข้อว่าง ข้อที่ฝนหลายตัวเลือก และรอยฝนไม่ชัดให้ครูตรวจเอง ไม่ยืนยันผลสอบอัตโนมัติ</p>
    </section>
  );
}
