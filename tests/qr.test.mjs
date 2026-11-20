import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentQrPayload, studentQrPayload } from "../lib/qr.ts";

test("new student QR payloads identify the OMR V2 format", () => {
  assert.equal(studentQrPayload("student-token"), "QEC2:student-token");
  assert.equal(parseStudentQrPayload("QEC2:student-token"), "student-token");
});

test("legacy QEC1 QR payloads remain valid for student identification", () => {
  assert.equal(parseStudentQrPayload("QEC1:legacy-token"), "legacy-token");
});

test("foreign and empty QR payloads are rejected", () => {
  assert.equal(parseStudentQrPayload("https://example.com"), null);
  assert.equal(parseStudentQrPayload("QEC2:"), null);
  assert.equal(parseStudentQrPayload("QEC1:"), null);
});
