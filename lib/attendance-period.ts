export const MIN_ATTENDANCE_PERIOD = 1;
export const MAX_ATTENDANCE_PERIOD = 8;

export function parseAttendancePeriod(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= MIN_ATTENDANCE_PERIOD && parsed <= MAX_ATTENDANCE_PERIOD ? parsed : null;
}
