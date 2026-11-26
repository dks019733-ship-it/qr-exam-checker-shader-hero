import test from "node:test";
import assert from "node:assert/strict";
import {
  signStudentToken,
  verifyStudentToken,
  hashStudentPin,
  verifyStudentPin,
} from "../lib/student-token.ts";
import {
  hasRequiredStudentLoginFactors,
  matchesStudentLogin,
} from "../lib/student-auth.ts";

test("verifies a correctly signed student token", () => {
  const token = signStudentToken({ studentId: "student-1", studentNo: "1", classId: "class-1" });
  assert.equal(verifyStudentToken(token)?.studentId, "student-1");
});

test("rejects malformed, expired and tampered student tokens", () => {
  const valid = signStudentToken({ studentId: "student-1", studentNo: "1", classId: "class-1" });
  const [payload, signature] = valid.split(".");
  for (const malformed of [
    `${payload}.x`,
    `${payload}.`,
    `${payload}.short`,
    `${payload}.${signature}.${signature}`,
    "not-a-token",
    "",
  ]) {
    assert.doesNotThrow(() => verifyStudentToken(malformed));
    assert.equal(verifyStudentToken(malformed), null);
  }
  assert.equal(verifyStudentToken(`${payload.slice(0, -1)}x.${signature}`), null);
});

test("fails closed when no server signing secret is configured", () => {
  const authSecret = process.env.AUTH_SECRET;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  try {
    assert.throws(
      () => signStudentToken({ studentId: "student-1", studentNo: "1", classId: "class-1" }),
      /STUDENT_TOKEN_SECRET_NOT_CONFIGURED/,
    );
    assert.equal(verifyStudentToken("payload.signature"), null);
  } finally {
    if (authSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = authSecret;
    if (nextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = nextAuthSecret;
  }
});

test("hashes and verifies versioned PBKDF2 PINs", async () => {
  const hash = await hashStudentPin("1234");
  assert.match(hash, /^pbkdf2-sha256\$600000\$/);
  assert.equal(await verifyStudentPin("1234", hash), true);
  assert.equal(await verifyStudentPin("0000", hash), false);
});

test("rejects plaintext, weak and malformed legacy PIN hashes", async () => {
  for (const malformed of [
    "1234",
    "salt:" + "a".repeat(64),
    "pbkdf2-sha256$1000$" + "a".repeat(32) + "$" + "b".repeat(64),
    "pbkdf2-sha256$600000$salt$abc",
    "pbkdf2-sha256$600000$" + "a".repeat(32) + "$" + "b".repeat(63),
    "pbkdf2-sha256$600000$" + "a".repeat(32) + "$" + "b".repeat(64) + "$extra",
  ]) {
    assert.equal(await verifyStudentPin("1234", malformed), false);
  }
});

test("requires both student code and a second login factor", () => {
  assert.equal(hasRequiredStudentLoginFactors("S001", "12"), true);
  assert.equal(hasRequiredStudentLoginFactors("S001", ""), false);
  assert.equal(hasRequiredStudentLoginFactors("", "12"), false);
  assert.equal(hasRequiredStudentLoginFactors("", ""), false);
});

test("accepts matching student code and roll number", async () => {
  assert.equal(await matchesStudentLogin(
    { studentNo: "S001", rollNo: "05" },
    "s001",
    "5",
  ), true);
});

test("rejects a correct student code without the second factor", async () => {
  assert.equal(await matchesStudentLogin(
    { studentNo: "S001", rollNo: "5" },
    "S001",
    "",
  ), false);
});

test("rejects a correct roll number without the student code", async () => {
  assert.equal(await matchesStudentLogin(
    { studentNo: "S001", rollNo: "5" },
    "",
    "5",
  ), false);
});

test("accepts a configured PIN only with the correct student code", async () => {
  const pinHash = await hashStudentPin("7391");
  const candidate = { studentNo: "S001", rollNo: "5", identity: { pinHash } };
  assert.equal(await matchesStudentLogin(candidate, "S001", "7391"), true);
  assert.equal(await matchesStudentLogin(candidate, "S002", "7391"), false);
});
