import {
  createHmac,
  pbkdf2,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const STUDENT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STUDENT_PIN_ITERATIONS = 600_000;
const STUDENT_PIN_KEY_LENGTH = 32;

function getStudentTokenSecret(): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
}

export interface StudentTokenPayload {
  studentId: string;
  studentNo: string;
  classId: string;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed student session.
 * A missing server secret is a configuration error; never fall back to a source-code key.
 */
export function signStudentToken(payload: {
  studentId: string;
  studentNo: string;
  classId: string;
}): string {
  const secret = getStudentTokenSecret();
  if (!secret) throw new Error("STUDENT_TOKEN_SECRET_NOT_CONFIGURED");

  const data: StudentTokenPayload = {
    ...payload,
    exp: Date.now() + STUDENT_TOKEN_TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", secret).update(json).digest("base64url");
  return `${json}.${signature}`;
}

/**
 * Verifies the signature, expiry and complete student identity claims.
 * Invalid configuration or malformed input always fails closed.
 */
export function verifyStudentToken(token: string): StudentTokenPayload | null {
  const secret = getStudentTokenSecret();
  if (!secret || typeof token !== "string" || !token || !token.includes(".")) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [json, signature] = parts;
  if (!json || !signature) return null;

  const signatureBytes = Buffer.from(signature);
  const expectedSig = createHmac("sha256", secret).update(json).digest("base64url");
  const expectedBytes = Buffer.from(expectedSig);
  if (
    signatureBytes.length !== expectedBytes.length ||
    !timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(json, "base64url").toString("utf-8")) as Partial<StudentTokenPayload>;
    if (
      typeof data.studentId !== "string" || !data.studentId ||
      typeof data.studentNo !== "string" || !data.studentNo ||
      typeof data.classId !== "string" || !data.classId ||
      typeof data.exp !== "number" || !Number.isSafeInteger(data.exp) ||
      Date.now() >= data.exp
    ) {
      return null;
    }
    return data as StudentTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Hashes a student PIN with PBKDF2-HMAC-SHA256 and a per-PIN random salt.
 * The asynchronous implementation avoids blocking the Node.js event loop.
 */
export async function hashStudentPin(pin: string): Promise<string> {
  const normalizedPin = pin.trim();
  if (!normalizedPin) throw new Error("STUDENT_PIN_EMPTY");

  const salt = randomBytes(16).toString("hex");
  const derived = await pbkdf2Async(
    normalizedPin,
    salt,
    STUDENT_PIN_ITERATIONS,
    STUDENT_PIN_KEY_LENGTH,
    "sha256",
  ) as Buffer;
  return `pbkdf2-sha256$${STUDENT_PIN_ITERATIONS}$${salt}$${derived.toString("hex")}`;
}

/**
 * Verifies only the current versioned PBKDF2 format.
 * Plain-text and weak legacy hashes are intentionally rejected; no PINs are currently configured.
 */
export async function verifyStudentPin(pin: string, storedHash: string): Promise<boolean> {
  if (typeof pin !== "string" || typeof storedHash !== "string") return false;
  const [algorithm, iterationsText, salt, expectedHex, ...extra] = storedHash.split("$");
  const iterations = Number(iterationsText);
  if (
    algorithm !== "pbkdf2-sha256" ||
    extra.length !== 0 ||
    !Number.isSafeInteger(iterations) ||
    iterations < STUDENT_PIN_ITERATIONS ||
    !/^[a-f0-9]{32}$/i.test(salt || "") ||
    !/^[a-f0-9]{64}$/i.test(expectedHex || "")
  ) {
    return false;
  }

  try {
    const actual = await pbkdf2Async(
      pin.trim(),
      salt,
      iterations,
      STUDENT_PIN_KEY_LENGTH,
      "sha256",
    ) as Buffer;
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
