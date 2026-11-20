export type StudentQrVersion = 1 | 2;

const CURRENT_PREFIX = "QEC2:";
const LEGACY_PREFIX = "QEC1:";

export function createStudentQrPayload(qrToken: string) {
  return CURRENT_PREFIX + qrToken;
}

export function parseStudentQrPayloadVersion(payload: string): { token: string; version: StudentQrVersion } | null {
  const normalized = payload.trim();
  const prefix = normalized.startsWith(CURRENT_PREFIX) ? CURRENT_PREFIX : normalized.startsWith(LEGACY_PREFIX) ? LEGACY_PREFIX : null;
  if (!prefix) return null;
  const token = normalized.slice(prefix.length).trim();
  if (!token) return null;
  return { token, version: prefix === CURRENT_PREFIX ? 2 : 1 };
}
