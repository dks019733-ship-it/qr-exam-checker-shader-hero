import assert from "node:assert/strict";
import test from "node:test";
import { createStudentQrPayload, parseStudentQrPayloadVersion } from "../lib/student-qr-format.ts";

test("new student QR payloads identify the OMR V2 format", () => {
  assert.equal(createStudentQrPayload("student-token"), "QEC2:student-token");
  assert.equal(parseStudentQrPayloadVersion("QEC2:student-token")?.token ?? null, "student-token");
  assert.deepEqual(parseStudentQrPayloadVersion("QEC2:student-token"), { token: "student-token", version: 2 });
});

test("legacy QEC1 QR payloads remain valid for student identification", () => {
  assert.equal(parseStudentQrPayloadVersion("QEC1:legacy-token")?.token ?? null, "legacy-token");
  assert.deepEqual(parseStudentQrPayloadVersion("QEC1:legacy-token"), { token: "legacy-token", version: 1 });
});

test("foreign and empty QR payloads are rejected", () => {
  assert.equal(parseStudentQrPayloadVersion("https://example.com")?.token ?? null, null);
  assert.equal(parseStudentQrPayloadVersion("QEC2:")?.token ?? null, null);
  assert.equal(parseStudentQrPayloadVersion("QEC1:")?.token ?? null, null);
});
