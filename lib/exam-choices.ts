export type ExamChoiceLabelStyle = "LATIN" | "THAI" | "NUMERIC";

const CANONICAL_KEYS = ["A", "B", "C", "D", "E"] as const;
const LABELS: Record<ExamChoiceLabelStyle, readonly string[]> = {
  LATIN: ["A", "B", "C", "D", "E"],
  THAI: ["ก", "ข", "ค", "ง", "จ"],
  NUMERIC: ["1", "2", "3", "4", "5"],
};

export function getExamChoiceKeys(choiceCount: number): string[] {
  return CANONICAL_KEYS.slice(0, choiceCount === 5 ? 5 : 4);
}

export function getExamChoiceLabels(choiceCount: number, style: string): string[] {
  const normalizedStyle: ExamChoiceLabelStyle =
    style === "THAI" || style === "NUMERIC" ? style : "LATIN";
  return LABELS[normalizedStyle].slice(0, choiceCount === 5 ? 5 : 4);
}
