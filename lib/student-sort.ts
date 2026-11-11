export type StudentRollOrder = {
  rollNo?: string | null;
  studentNo?: string | null;
  name?: string | null;
};

/**
 * Numeric roster ordering: roll number is always primary; blank roll numbers
 * are placed last. Student number/name are deterministic tie-breakers only.
 */
export function compareByRollNo(a: StudentRollOrder, b: StudentRollOrder): number {
  const left = (a.rollNo ?? "").trim();
  const right = (b.rollNo ?? "").trim();

  if (!left && right) return 1;
  if (left && !right) return -1;

  const byRollNo = left.localeCompare(right, "th", { numeric: true });
  if (byRollNo !== 0) return byRollNo;

  const byStudentNo = (a.studentNo ?? "").localeCompare(b.studentNo ?? "", "th", { numeric: true });
  if (byStudentNo !== 0) return byStudentNo;

  return (a.name ?? "").localeCompare(b.name ?? "", "th", { numeric: true });
}
