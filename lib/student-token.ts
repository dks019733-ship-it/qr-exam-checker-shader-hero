import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "student-portal-secret-token-key-2026";

export interface StudentTokenPayload {
  studentId: string;
  studentNo: string;
  classId: string;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed token for authenticated student sessions.
 */
export function signStudentToken(payload: { studentId: string; studentNo: string; classId: string }): string {
  const data: StudentTokenPayload = {
    ...payload,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days expiration
  };
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(json).digest("base64url");
  return `${json}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed student token.
 */
export function verifyStudentToken(token: string): StudentTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [json, signature] = parts;
  if (!json || !signature) return null;

  const signatureBytes = Buffer.from(signature);
  const expectedSig = crypto.createHmac("sha256", SECRET).update(json).digest("base64url");
  const expectedBytes = Buffer.from(expectedSig);
  if (signatureBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(signatureBytes, expectedBytes)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(json, "base64url").toString("utf-8")) as StudentTokenPayload;
    if (!data.studentId || !data.exp || Date.now() > data.exp) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Hashes a student PIN using SHA-256 with salt.
 */
export function hashStudentPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(pin.trim(), salt, 1000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Validates a student PIN against its stored PBKDF2 hash, or plain match if legacy.
 */
export function verifyStudentPin(pin: string, storedHashOrValue: string): boolean {
  if (!storedHashOrValue) return false;
  if (storedHashOrValue.includes(":")) {
    try {
      const [salt, hash, ...extra] = storedHashOrValue.split(":");
      if (!salt || !hash || extra.length > 0 || !/^[a-f0-9]{64}$/i.test(hash)) return false;
      const testHash = crypto.pbkdf2Sync(pin.trim(), salt, 1000, 32, "sha256").toString("hex");
      const storedBytes = Buffer.from(hash, "hex");
      const testBytes = Buffer.from(testHash, "hex");
      return storedBytes.length === testBytes.length && crypto.timingSafeEqual(storedBytes, testBytes);
    } catch {
      return false;
    }
  }
  return storedHashOrValue.trim() === pin.trim();
}
