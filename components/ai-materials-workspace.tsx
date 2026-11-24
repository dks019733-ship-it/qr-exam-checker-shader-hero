"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  GraduationCap,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { GeneratedMaterial, MaterialKind, materialsApi } from "@/lib/ai-api";

const learningAreas = [
  "ภาษาไทย",
  "คณิตศาสตร์",
  "วิทยาศาสตร์และเทคโนโลยี",
  "สังคมศึกษา ศาสนา และวัฒนธรรม",
  "สุขศึกษาและพลศึกษา",
  "ศิลปะ",
  "การงานอาชีพ",
  "ภาษาต่างประเทศ",
];

const fieldClass =
  "mt-2 w-full rounded-2xl border border-[#dce5dc] bg-[#f8faf7] px-4 py-3 text-sm text-[#17271b] outline-none transition placeholder:text-[#9aa79b] hover:border-[#b9cbb9] focus:border-[#496344] focus:bg-white focus:ring-4 focus:ring-[#496344]/10";
const labelClass = "block text-sm font-semibold text-[#263b2a]";
type StatusFilter = "all" | "pending_review" | "approved";

export function AiMaterialsWorkspace({ initialKind }: { initialKind: MaterialKind }) {
  const router = useRouter();
  const [kind, setKind] = useState<MaterialKind>(initialKind);
  const [materials, setMaterials] = useState<GeneratedMaterial[]>([]);
  const [subject, setSubject] = useState("");
  const [defaultLearningArea, setDefaultLearningArea] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("ปานกลาง");
  const [documentType, setDocumentType] = useState("ใบงาน");
  const [worksheetStyle, setWorksheetStyle] = useState<"cute" | "editable">("cute");
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    setKind(initialKind);
    materialsApi
      .list()
      .then(({ materials: rows }) => setMaterials(rows.filter((item) => item.kind === initialKind)))
      .catch((err) => setPageError(err.message));
    fetch("/api/teacher-settings")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "โหลดกลุ่มสาระประจำครูไม่สำเร็จ");
        const area = typeof data.defaultLearningArea === "string" ? data.defaultLearningArea : "";
        setDefaultLearningArea(area);
        setSubject((current) => current || area);
      })
      .catch((error) =>
        setSettingsMessage(error instanceof Error ? error.message : "โหลดกลุ่มสาระประจำครูไม่สำเร็จ"),
      );
  }, [initialKind]);

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    return materials.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch =
        !query ||
        [item.title, item.subject, item.grade_level].some((value) =>
          value.toLocaleLowerCase("th").includes(query),
        );
      return matchesStatus && matchesSearch;
    });
  }, [materials, search, statusFilter]);

  const completedFields = [subject, gradeLevel, topic].filter((value) => value.trim()).length;
  const completionPercent = Math.round((completedFields / 3) * 100);
  const estimatedMinutes = Math.max(5, Math.round(questionCount * 1.25));
  const isGoogleForm = kind === "google_form";
  const pageTitle = isGoogleForm
    ? "สร้าง Google Forms ด้วย AI"
    : kind === "exam"
      ? "สร้างข้อสอบกระดาษด้วย AI"
      : "สร้างเอกสารด้วย AI";
  const collectionTitle = isGoogleForm
    ? "แบบทดสอบออนไลน์ที่สร้างไว้"
    : kind === "exam"
      ? "ข้อสอบกระดาษที่สร้างไว้"
      : "เอกสารที่สร้างไว้";

  async function saveDefaultLearningArea() {
    setSavingArea(true);
    setSettingsMessage("");
    try {
      const response = await fetch("/api/teacher-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultLearningArea: subject }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "บันทึกกลุ่มสาระไม่สำเร็จ");
      setDefaultLearningArea(data.defaultLearningArea || "");
      setSettingsMessage("บันทึกกลุ่มสาระประจำครูแล้ว");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "บันทึกกลุ่มสาระไม่สำเร็จ");
    } finally {
      setSavingArea(false);
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    try {
      const { material } = await materialsApi.generate({
        kind,
        subject,
        gradeLevel,
        topic,
        learningObjectives: objectives,
        difficulty,
        ...(kind !== "document"
          ? { questionCount, questionTypes: ["ปรนัย", "อัตนัยสั้น"] }
          : {
              documentType,
              ...(documentType === "ใบงาน" ? { worksheetStyle } : {}),
            }),
      });
      router.push(`/dashboard/ai/materials/${material.id}`);
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : "สร้างร่างไม่สำเร็จ");
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (
      !selectedIds.length ||
      !window.confirm(
        `ลบงาน ${selectedIds.length} รายการออกจากระบบหรือไม่? Google Forms ที่สร้างไว้ยังอยู่ใน Drive`,
      )
    )
      return;
    setLoading(true);
    try {
      const response = await fetch("/api/ai/materials", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ลบงานไม่สำเร็จ");
      setMaterials((rows) => rows.filter((row) => !selectedIds.includes(row.id)));
      setSelectedIds([]);
      setPageError("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "ลบงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectAll() {
    const visibleIds = filteredMaterials.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#f5f7f3] px-4 py-5 text-[#17271b] sm:px-6 sm:py-8 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(at 8% 4%, rgba(29,45,27,.08) 0, transparent 42%), radial-gradient(at 94% 10%, rgba(39,58,36,.06) 0, transparent 44%), linear-gradient(to right, rgba(22,36,20,.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(22,36,20,.025) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
        }}
      />

      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-[2rem] border border-[#dce6d9] bg-white/95 px-5 py-6 shadow-[0_20px_50px_-35px_rgba(15,26,14,.28)] backdrop-blur-xl sm:px-8 md:flex-row md:items-center">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#e8efe5] blur-3xl" />
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() =>
                router.push(
                  kind === "document"
                    ? "/dashboard/documents"
                    : kind === "google_form"
                      ? "/dashboard/google-forms"
                      : "/dashboard/exams",
                )
              }
              className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#60745e] transition hover:text-[#1d2d1b]"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าจัดการ{isGoogleForm ? "Google Forms" : kind === "exam" ? "ข้อสอบกระดาษ" : "เอกสาร"}
            </button>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#6d806a]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ea] text-[#354c31]">
                <Sparkles className="h-4 w-4" />
              </span>
              Smart Studio · AI workspace
            </div>
            <h1 className="font-semibold tracking-tight text-[#162414] text-2xl sm:text-3xl">{pageTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e7b6e]">
              {isGoogleForm
                ? "ออกแบบแบบทดสอบออนไลน์ตามตัวชี้วัด ให้ AI ช่วยร่าง แล้วตรวจแก้ก่อนสร้าง Google Forms"
                : "AI จะสร้างเป็นร่างให้ครูตรวจ แก้ไข และอนุมัติก่อนใช้งาน"}
            </p>
          </div>

          <div className="relative w-full rounded-2xl border border-[#e3eae0] bg-[#f7faf5] p-4 md:max-w-[230px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#61745e]">ความพร้อมของข้อมูล</span>
              <span className="text-lg font-bold tabular-nums text-[#273a24]">{completionPercent}%</span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[#e3eae1]"
              role="progressbar"
              aria-label="ความพร้อมของข้อมูล"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionPercent}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#496344] to-[#273a24] transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[#819080]">
              {completionPercent === 100 ? "ข้อมูลหลักครบแล้ว พร้อมสร้างร่าง" : "กรอกวิชา ระดับชั้น และหัวข้อเพื่อเริ่มต้น"}
            </p>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="relative overflow-hidden rounded-[2rem] border border-[#dce6d9] bg-white/95 p-5 shadow-[0_20px_50px_-35px_rgba(15,26,14,.25)] backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-[#81917d]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#496344]" />
                  CONFIGURATION
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[#1d2d1b]">กำหนดรายละเอียดแบบทดสอบ</h2>
                <p className="mt-1 text-xs leading-5 text-[#829080]">ข้อมูลเหล่านี้จะใช้เป็นบริบทให้ AI สร้างร่าง</p>
              </div>
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f0f5ed] text-[#496344] sm:flex">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-5">
              <div className="rounded-2xl border border-[#e1e9dd] bg-[#f8faf7] p-4">
                <label className={labelClass}>
                  กลุ่มสาระ / วิชา
                  <input
                    required
                    list="learning-area-options"
                    maxLength={160}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className={fieldClass}
                    placeholder="เช่น สังคมศึกษา ศาสนา และวัฒนธรรม"
                  />
                </label>
                <datalist id="learning-area-options">
                  {learningAreas.map((area) => (
                    <option key={area} value={area} />
                  ))}
                </datalist>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[#788676]">
                    ค่าเริ่มต้นประจำครู: {defaultLearningArea || "ยังไม่ได้ตั้ง"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void saveDefaultLearningArea()}
                    disabled={savingArea || !subject.trim() || subject === defaultLearningArea}
                    className="rounded-xl border border-[#d8e2d4] bg-white px-3 py-2 text-[11px] font-semibold text-[#40583c] transition hover:border-[#9eb39a] hover:bg-[#f2f7ef] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {savingArea ? "กำลังบันทึก..." : "ตั้งเป็นกลุ่มสาระประจำครู"}
                  </button>
                </div>
                {settingsMessage && (
                  <p role="status" className="mt-2 text-xs text-[#496344]">
                    {settingsMessage}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-[#6e8268]" />
                    ระดับชั้น
                  </span>
                  <input
                    required
                    maxLength={160}
                    value={gradeLevel}
                    onChange={(event) => setGradeLevel(event.target.value)}
                    className={fieldClass}
                    placeholder="เช่น ป.6"
                  />
                </label>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#6e8268]" />
                    หัวข้อ
                  </span>
                  <input
                    required
                    maxLength={160}
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className={fieldClass}
                    placeholder="เช่น ระบบสุริยะ"
                  />
                </label>
              </div>

              <label className={labelClass}>
                <span className="inline-flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#6e8268]" />
                  ตัวชี้วัดหรือจุดประสงค์
                  <span className="font-normal text-[#9aa79b]">(ไม่บังคับ)</span>
                </span>
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={objectives}
                  onChange={(event) => setObjectives(event.target.value)}
                  className={`${fieldClass} resize-y leading-6`}
                  placeholder="ระบุสิ่งที่ต้องการให้นักเรียนรู้หรือทำได้"
                />
                <span className="mt-1 block text-right text-[10px] font-normal text-[#9aa79b]">
                  {objectives.length.toLocaleString("th-TH")} / 3,000 ตัวอักษร
                </span>
              </label>

              {kind !== "document" ? (
                <div className="space-y-5 rounded-2xl border border-[#e3eae0] bg-[#fbfcfa] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="question-count" className={labelClass}>
                      จำนวนข้อ
                    </label>
                    <span className="rounded-xl bg-[#eaf1e7] px-3 py-1.5 text-sm font-bold tabular-nums text-[#273a24]">
                      {questionCount} ข้อ
                    </span>
                  </div>
                  <input
                    id="question-count"
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    value={questionCount}
                    onChange={(event) => setQuestionCount(Number(event.target.value))}
                    aria-label="จำนวนข้อ"
                    className="h-2 w-full cursor-pointer accent-[#273a24]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-[#899587]">1 ข้อ</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[5, 10, 20, 30, 40].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuestionCount(count)}
                          aria-pressed={questionCount === count}
                          className={`min-w-9 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${questionCount === count ? "bg-[#273a24] text-white shadow-sm" : "border border-[#e0e7dc] bg-white text-[#667663] hover:border-[#a9bca3]"}`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-[#899587]">40 ข้อ</span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#e8eee5] pt-3 text-xs text-[#748372]">
                    <Clock3 className="h-4 w-4 text-[#81947b]" />
                    เวลาทำข้อสอบโดยประมาณ: {estimatedMinutes}–{estimatedMinutes + 5} นาที
                  </div>

                  <div>
                    <p className={labelClass}>ระดับความยาก</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {["ง่าย", "ปานกลาง", "ยาก"].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          aria-pressed={difficulty === level}
                          className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${difficulty === level ? "border-[#273a24] bg-[#273a24] text-white shadow-[0_6px_16px_-8px_rgba(22,36,20,.65)]" : "border-[#e0e7dc] bg-white text-[#6e7d6a] hover:border-[#a9bca3] hover:bg-[#f6f9f4]"}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    ประเภทเอกสาร
                    <select
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value)}
                      className={fieldClass}
                    >
                      <option>ใบงาน</option>
                      <option>แผนการจัดการเรียนรู้</option>
                      <option>เอกสารประกอบการสอน</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    รายละเอียดเพิ่มเติม
                    <input value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={fieldClass} />
                  </label>
                  {documentType === "ใบงาน" && (
                    <label className={`${labelClass} sm:col-span-2`}>
                      รูปแบบใบงาน
                      <select
                        value={worksheetStyle}
                        onChange={(event) => setWorksheetStyle(event.target.value as "cute" | "editable")}
                        className={fieldClass}
                      >
                        <option value="cute">น่ารักสำหรับนักเรียน · พิมพ์/บันทึกเป็น PDF</option>
                        <option value="editable">เรียบจริงจัง · แก้ไขต่อใน Word</option>
                      </select>
                      <span className="mt-2 block text-xs font-normal leading-5 text-[#7c897a]">
                        ทั้งสองแบบครูตรวจและแก้เนื้อหาก่อนอนุมัติได้
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-[#dfe8dc] bg-gradient-to-br from-[#f3f7f0] to-[#fafcf9] p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-[#62775d]">
                  <Sparkles className="h-3.5 w-3.5" />
                  LIVE AI BLUEPRINT
                </div>
                <p className="mt-2 text-sm font-semibold text-[#263b2a]">
                  {questionCount} ข้อ · {difficulty} · {gradeLevel.trim() || "ยังไม่ระบุระดับชั้น"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#71816e]">
                  {topic.trim()
                    ? `เตรียมร่างคำถามเรื่อง “${topic.trim()}” ในวิชา${subject.trim() ? ` ${subject.trim()}` : "ที่ระบุ"}`
                    : "กรอกหัวข้อและระดับชั้นเพื่อแสดงภาพรวมชุดคำถาม"}
                </p>
              </div>

              {pageError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {pageError}
                </p>
              )}
              <button
                disabled={loading}
                className="group relative inline-flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1d2d1b] via-[#273a24] to-[#354c31] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-10px_rgba(22,36,20,.5)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_35px_-10px_rgba(22,36,20,.55)] disabled:cursor-wait disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4 transition group-hover:rotate-12" />
                {loading ? "กำลังสร้างร่าง..." : "สร้างร่างเพื่อให้ครูตรวจ"}
                <ChevronRight className="h-4 w-4" />
              </button>
              <p className="text-center text-[11px] leading-5 text-[#899587]">
                ห้ามนำเนื้อหาไปใช้กับนักเรียนจนกว่าจะตรวจและกดอนุมัติ
              </p>
            </form>
          </section>

          <section className="flex min-h-[640px] flex-col overflow-hidden rounded-[2rem] border border-[#dce6d9] bg-white/95 p-5 shadow-[0_20px_50px_-35px_rgba(15,26,14,.25)] backdrop-blur-xl sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-[#81917d]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#496344]" />
                  MY LIBRARY
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[#1d2d1b]">{collectionTitle}</h2>
                <p className="mt-1 text-xs text-[#829080]">จัดการร่าง ตรวจทาน และกลับไปแก้ไขงานที่บันทึกไว้</p>
              </div>
              <div className="rounded-xl bg-[#f0f5ed] px-3 py-2 text-center">
                <p className="text-xl font-bold tabular-nums text-[#273a24]">{materials.length}</p>
                <p className="text-[9px] font-semibold tracking-wide text-[#788976]">รายการ</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#e4ebe1] bg-[#f8faf7] p-3">
                <p className="text-[10px] text-[#849181]">ทั้งหมด</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-[#273a24]">{materials.length}</p>
              </div>
              <div className="rounded-xl border border-[#e4ebe1] bg-[#f8faf7] p-3">
                <p className="text-[10px] text-[#849181]">รอตรวจ</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-[#9a742d]">
                  {materials.filter((item) => item.status === "pending_review").length}
                </p>
              </div>
              <div className="rounded-xl border border-[#e4ebe1] bg-[#f8faf7] p-3">
                <p className="text-[10px] text-[#849181]">อนุมัติแล้ว</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-[#3f7049]">
                  {materials.filter((item) => item.status === "approved").length}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91a08e]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาชื่อแบบทดสอบหรือระดับชั้น..."
                  aria-label="ค้นหาแบบทดสอบ"
                  className="w-full rounded-xl border border-[#e0e8dd] bg-[#fafcf9] py-2.5 pl-9 pr-3 text-xs outline-none transition placeholder:text-[#9aa79b] focus:border-[#789274] focus:ring-3 focus:ring-[#496344]/10"
                />
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={!filteredMaterials.length}
                className="rounded-xl border border-[#dce6d9] px-3 py-2 text-xs font-semibold text-[#536b4f] transition hover:bg-[#f3f7f0] disabled:opacity-40"
              >
                {filteredMaterials.length > 0 && filteredMaterials.every((item) => selectedIds.includes(item.id))
                  ? "ยกเลิกเลือกทั้งหมด"
                  : "เลือกทั้งหมด"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" aria-label="กรองสถานะ">
                {([
                  ["all", "ทั้งหมด"],
                  ["pending_review", "รอตรวจ"],
                  ["approved", "ยืนยันแล้ว"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    aria-pressed={statusFilter === value}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${statusFilter === value ? "bg-[#273a24] text-white" : "bg-[#f2f6ef] text-[#6d7e68] hover:bg-[#e7efe3]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  ลบที่เลือก ({selectedIds.length})
                </button>
              )}
            </div>

            {pageError && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pageError}
              </p>
            )}

            <div className="mt-4 flex-1 space-y-3">
              {materials.length === 0 && !pageError ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d4e0d0] bg-[#f9fbf8] px-6 py-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#496344]">
                    <FileSpreadsheet className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold text-[#2b422e]">ยังไม่มีแบบทดสอบออนไลน์ที่สร้างไว้</h3>
                  <p className="mt-2 max-w-sm text-xs leading-6 text-[#829080]">
                    กรอกรายละเอียดทางด้านซ้าย แล้วกดสร้างร่างเพื่อให้ AI ช่วยออกแบบชุดคำถาม
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[#61775c]">
                    เริ่มต้นสร้างแบบทดสอบ <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              ) : filteredMaterials.length ? (
                filteredMaterials.map((item) => (
                  <article
                    key={item.id}
                    className="group flex items-start gap-3 rounded-2xl border border-[#e3eae0] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#b8cbb2] hover:bg-[#fbfdfb] hover:shadow-[0_12px_25px_-22px_rgba(22,36,20,.45)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                      aria-label={`เลือก ${item.title} เพื่อลบ`}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#273a24]"
                    />
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/ai/materials/${item.id}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === "approved" ? "bg-[#e8f2e5] text-[#3d6941]" : "bg-[#fff4df] text-[#8a641e]"}`}
                        >
                          {item.status === "approved" ? "อนุมัติแล้ว" : "รอครูตรวจ"}
                        </span>
                        <span className="text-[10px] text-[#98a397]">
                          {isGoogleForm ? "แบบทดสอบออนไลน์" : kind === "exam" ? "ข้อสอบกระดาษ" : "เอกสาร"}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-sm font-semibold text-[#273a24] transition group-hover:text-[#496344]">
                        {item.title}
                      </h3>
                      <p className="mt-1 truncate text-[11px] text-[#829080]">
                        {item.subject} · {item.grade_level}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/ai/materials/${item.id}`)}
                      aria-label={`เปิด ${item.title}`}
                      className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#829080] transition hover:bg-[#edf3e9] hover:text-[#273a24]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#dce6d9] bg-[#fafcf9] px-5 py-12 text-center">
                  <Search className="mx-auto h-6 w-6 text-[#9aa79b]" />
                  <p className="mt-3 text-sm font-medium text-[#52644f]">ไม่พบรายการที่ตรงกับการค้นหา</p>
                  <p className="mt-1 text-xs text-[#8a9788]">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
