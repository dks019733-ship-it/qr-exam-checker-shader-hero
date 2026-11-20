import test from "node:test";
import assert from "node:assert/strict";
import { parseAttendancePeriod } from "../lib/attendance-period.ts";

test("accepts periods 1 through 8 as numbers or query strings", () => {
  for (let period = 1; period <= 8; period += 1) {
    assert.equal(parseAttendancePeriod(period), period);
    assert.equal(parseAttendancePeriod(String(period)), period);
  }
});

test("rejects invalid and out-of-range periods", () => {
  for (const value of [0, 9, -1, 1.5, "", "1x", "0", "9", null, undefined, true]) assert.equal(parseAttendancePeriod(value), null);
});
