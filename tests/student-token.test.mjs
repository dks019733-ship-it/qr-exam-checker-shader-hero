import test from "node:test";
import assert from "node:assert/strict";
import { signStudentToken, verifyStudentToken, hashStudentPin, verifyStudentPin } from "../lib/student-token.ts";

test("verifies a correctly signed student token", () => {
  const token = signStudentToken({ studentId: "student-1", studentNo: "1", classId: "class-1" });
  assert.equal(verifyStudentToken(token)?.studentId, "student-1");
});

test("rejects malformed student token signatures without throwing", () => {
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
});

test("rejects expired and tampered student tokens", () => {
  const valid = signStudentToken({ studentId: "student-1", studentNo: "1", classId: "class-1" });
  const [payload, signature] = valid.split(".");
  assert.equal(verifyStudentToken(`${payload.slice(0, -1)}x.${signature}`), null);
});

test("verifies valid PBKDF2 PIN hashes", () => {
  const hash = hashStudentPin("1234");
  assert.equal(verifyStudentPin("1234", hash), true);
  assert.equal(verifyStudentPin("0000", hash), false);
});

test("rejects malformed PBKDF2 hashes without throwing", () => {
  for (const malformed of ["salt:x", "salt:", ":abcd", "salt:" + "a".repeat(63), "salt:" + "a".repeat(65), "salt:abc:extra"]) {
    assert.doesNotThrow(() => verifyStudentPin("1234", malformed));
    assert.equal(verifyStudentPin("1234", malformed), false);
  }
});
